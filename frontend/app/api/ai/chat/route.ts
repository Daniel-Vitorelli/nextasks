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

const MAX_MESSAGE_LENGTH = 4000;

interface ChatRequestBody {
  conversationId?: string;
  message?: string;
  locale?: string;
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

  /* Fila global de rate limit (20 rpm): espera até haver slot livre.
     Se o cliente abortar enquanto aguarda, encerra silenciosamente. */
  try {
    await acquireAiSlot(request.signal);
  } catch (error) {
    if (error instanceof AbortedError || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    throw error;
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: CHAT_TEMPERATURE,
    max_tokens: CHAT_MAX_TOKENS,
    stream: true,
    messages: [
      { role: "system", content: systemContent },
      ...history.map((entry) => ({
        role: entry.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: entry.content,
      })),
    ],
  });

  /* Stream de texto puro; ao final persiste a resposta e dispara memória. */
  const userId = user.id;
  const conversationIdFinal = conversation.id;
  const encoder = new TextEncoder();
  let assistantText = "";
  let finalized = false;

  async function finalize() {
    if (finalized) return;
    finalized = true;
    // Persiste a resposta (mesmo parcial em aborts) e dispara memória sem bloquear.
    if (assistantText.trim()) {
      await prisma.chatMessage.create({
        data: {
          conversationId: conversationIdFinal,
          role: "assistant",
          content: assistantText,
        },
      }).catch(() => undefined);
      await prisma.chatConversation.update({
        where: { id: conversationIdFinal },
        data: { updatedAt: new Date() },
      }).catch(() => undefined);
    }
    void maybeSummarizeConversation(client!, model, conversationIdFinal, locale).catch(() => undefined);
    void maybeExtractMemoryFacts(client!, model, userId, locale).catch(() => undefined);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            assistantText += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      } catch {
        // Erro/abort no meio do stream: encerra com o que deu para gerar.
        controller.close();
      } finally {
        await finalize();
      }
    },
    cancel() {
      // Cliente desconectou: mantém o trecho parcial já gerado.
      void finalize();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversation.id,
    },
  });
}
