import { NextResponse } from "next/server";

import { badRequest, requireUser, unauthorized } from "@/lib/server/api";
import { buildSystemPrompt, loadAiContextData } from "@/lib/server/ai/context";
import {
  maybeExtractMemoryFacts,
  maybeSummarizeConversation,
} from "@/lib/server/ai/memory";
import {
  CHAT_MAX_TOKENS,
  CHAT_TEMPERATURE,
  getNimClient,
  nimModel,
  RECENT_MESSAGE_WINDOW,
} from "@/lib/server/ai/nim";
import { acquireAiSlot, AbortedError } from "@/lib/server/ai/rate-limit";
import { prisma } from "@/lib/server/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  AI_TOOLS,
  buildProposalActions,
  executeReadTool,
  validateProposalAction,
  type ProposalKind,
} from "@/lib/server/ai/tools";

const MAX_MESSAGE_LENGTH = 4000;

interface ChatRequestBody {
  conversationId?: string;
  message?: string;
  locale?: string;
  tzOffset?: number;
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!user) return unauthorized();

  const client = getNimClient();
  if (!client) {
    return NextResponse.json(
      { error: "AI is not configured (missing NVIDIA_NIM_API_KEY)" },
      { status: 503 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return badRequest("Message is required");
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }
  const locale = body.locale === "en" ? "en" : "pt";
  const model = nimModel();

  /* Conversa: existente do usuário ou nova. */
  let conversation = body.conversationId
    ? await prisma.chatConversation.findFirst({
        where: { id: body.conversationId, userId: user.id },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.chatConversation.create({
      data: {
        userId: user.id,
        title: message.slice(0, 60),
      },
    });
  }

  /* Persiste a mensagem do usuário e monta o contexto. */
  await prisma.chatMessage.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  const [contextData, history] = await Promise.all([
    loadAiContextData(user.id, locale),
    prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RECENT_MESSAGE_WINDOW,
      select: { role: true, content: true },
    }),
  ]);
  history.reverse();

  const systemContent =
    buildSystemPrompt(contextData) +
    (conversation.summary
      ? `\n\n## ${locale === "pt" ? "Resumo da conversa até agora" : "Conversation summary so far"}\n${conversation.summary}`
      : "");

  // -----------------------------------------------------------------------
  // Tool-aware agentic loop (non-streaming) para coletar propostas.
  // -----------------------------------------------------------------------
  type ChatMessageParam = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string };
  const baseMessages: ChatMessageParam[] = [
    { role: "system", content: systemContent },
    ...history.map((entry) => ({
      role: (entry.role === "assistant" ? "assistant" : "user") as ChatMessageParam["role"],
      content: entry.content,
    })),
  ];

  const pendingRaw: { kind: ProposalKind; params: Record<string, unknown>; validation: Awaited<ReturnType<typeof validateProposalAction>> }[] = [];
  let finalText: string | null = null;
  const toolLoopMessages: ChatMessageParam[] = [...baseMessages];
  for (let iter = 0; iter < 5; iter++) {
    try {
      await acquireAiSlot(request.signal);
    } catch (error) {
      if (error instanceof AbortedError || request.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      throw error;
    }

    // Tenta chamar com tools; se modelo não suportar, cai no catch e faz fallback
    let completion: Awaited<ReturnType<typeof client.chat.completions.create>>;
    try {
      completion = await client.chat.completions.create({
        model,
        temperature: CHAT_TEMPERATURE,
        max_tokens: CHAT_MAX_TOKENS,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: toolLoopMessages as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: AI_TOOLS as any,
        tool_choice: "auto",
      } as never);
    } catch {
      // Fallback sem tools (modelo pode não suportar)
      try {
        await acquireAiSlot(request.signal);
      } catch (e) {
        if (e instanceof AbortedError || request.signal.aborted) return new Response(null, { status: 499 });
        throw e;
      }
      completion = await client.chat.completions.create({
        model,
        temperature: CHAT_TEMPERATURE,
        max_tokens: CHAT_MAX_TOKENS,
        messages: toolLoopMessages.filter((m) => m.role !== "tool") as never,
      } as never);
      const fallbackMsg = completion.choices[0]?.message as { content?: string | null };
      finalText = fallbackMsg?.content ?? null;
      break;
    }

    const msg = completion.choices[0]?.message as {
      content?: string | null;
      tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
    };

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length > 0) {
      // Adiciona a mensagem assistant com tool_calls ao histórico do loop
      toolLoopMessages.push({
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: toolCalls,
      } as unknown as ChatMessageParam);

      let hasRead = false;
      for (const tc of toolCalls) {
        const name = tc.function.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }

        if (name.startsWith("list_")) {
          hasRead = true;
          const result = await executeReadTool(user.id, name, args).catch(() => ({ error: "read failed" }));
          toolLoopMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 8000),
          } as ChatMessageParam);
        } else if (name.startsWith("propose_")) {
          const kind = name.replace("propose_", "") as ProposalKind;
          const validation = await validateProposalAction(user.id, kind, args, locale);
          if (validation.ok) {
            pendingRaw.push({ kind, params: args, validation });
            toolLoopMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ ok: true, preview: validation.previewTitle }).slice(0, 2000),
            } as ChatMessageParam);
          } else {
            toolLoopMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ ok: false, error: validation.error }).slice(0, 2000),
            } as ChatMessageParam);
          }
        } else {
          toolLoopMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: "unknown tool" }),
          } as ChatMessageParam);
        }
      }

      // Se houve apenas propose e não read, ainda deixamos o LLM gerar texto final na próxima iteração
      // Se houve read, continuamos para permitir que LLM proponha após ler
      if (hasRead) continue;
      // Se só propose, vamos para próxima iteração para LLM gerar texto explicativo
      // Mas se já temos propostas e o LLM não retornou texto, continuamos uma vez para texto
      if (msg.content) finalText = msg.content;
      continue;
    }

    // Sem tool_calls: texto final
    if (msg.content) finalText = msg.content;
    break;
  }

  // Fallback de texto quando só houve propostas sem texto
  if (pendingRaw.length > 0 && !finalText) {
    finalText =
      locale === "pt"
        ? pendingRaw.length === 1
          ? `Criei uma proposta: ${pendingRaw[0].validation.previewTitle}. Revise abaixo e clique em Aceitar ou Recusar.`
          : `Criei ${pendingRaw.length} propostas para você revisar. Veja os cards abaixo.`
        : pendingRaw.length === 1
          ? `Created a proposal: ${pendingRaw[0].validation.previewTitle}. Review below to Accept or Reject.`
          : `Created ${pendingRaw.length} proposals for review. See the cards below.`;
  }
  if (!finalText) finalText = "";

  // Cria proposta no banco se houver ações válidas
  let proposalId: string | null = null;
  if (pendingRaw.length > 0) {
    const actions = buildProposalActions(pendingRaw);
    if (actions.length > 0) {
      const proposal = await prisma.aiProposal.create({
        data: {
          userId: user.id,
          conversationId: conversation.id,
          status: "pending",
          locale,
          actions: actions as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      proposalId = proposal.id;
    }
  }

  // Se não usou tools, mantém comportamento streaming original (para qualidade da resposta)
  // Mas já temos finalText. Vamos streamar finalText artificialmente para manter UX.
  // Se quiser streaming real quando sem propostas, poderíamos fazer uma chamada stream extra,
  // mas reaproveitar finalText é suficiente e evita custo duplo.
  // Para manter compatibilidade, vamos fazer streaming do finalText chunk a chunk.

  const userId = user.id;
  const conversationIdFinal = conversation.id;
  const proposalIdFinal = proposalId;
  const encoder = new TextEncoder();
  const assistantText = finalText;
  let finalized = false;

  async function finalize() {
    if (finalized) return;
    finalized = true;
    if (assistantText.trim() || proposalIdFinal) {
      await prisma.chatMessage
        .create({
          data: {
            conversationId: conversationIdFinal,
            role: "assistant",
            content: assistantText,
            proposalId: proposalIdFinal,
          },
        })
        .catch(() => undefined);
      await prisma.chatConversation
        .update({
          where: { id: conversationIdFinal },
          data: { updatedAt: new Date() },
        })
        .catch(() => undefined);
    }
    void maybeSummarizeConversation(client!, model, conversationIdFinal, locale).catch(() => undefined);
    void maybeExtractMemoryFacts(client!, model, userId, locale).catch(() => undefined);
  }

  // Se não houve propostas e não usou tools, podemos optar por fazer streaming real da LLM
  // para manter fluidez. Mas para simplificar e manter uma única resposta, usamos o finalText já gerado.
  // Para melhorar UX quando sem tools, fazemos um fallback streaming real na ausência de finalText? finalText já existe.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Simula streaming em chunks de ~40 chars para UX
        const chunkSize = 40;
        for (let i = 0; i < assistantText.length; i += chunkSize) {
          const chunk = assistantText.slice(i, i + chunkSize);
          controller.enqueue(encoder.encode(chunk));
          // pequeno delay para efeito streaming, mas não bloqueia muito
          await new Promise((r) => setTimeout(r, 12));
          if (request.signal.aborted) break;
        }
        controller.close();
      } catch {
        controller.close();
      } finally {
        await finalize();
      }
    },
    cancel() {
      void finalize();
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Conversation-Id": conversation.id,
  };
  if (proposalId) headers["X-Proposal-Id"] = proposalId;

  return new Response(stream, { headers });
}
