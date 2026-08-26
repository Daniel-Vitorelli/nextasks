import type OpenAI from "openai";

import {
  RECENT_MESSAGE_WINDOW,
  SUMMARY_TRIGGER_COUNT,
} from "@/lib/server/ai/nim";
import { acquireAiSlot } from "@/lib/server/ai/rate-limit";
import { prisma } from "@/lib/server/prisma";

const MAX_FACTS = 50;

/**
 * Resumo rolante da conversa: quando o histórico cresce além da janela,
 * resume as mensagens antigas (incluindo o resumo anterior) numa única
 * string que entra no system prompt das próximas chamadas.
 */
export async function maybeSummarizeConversation(
  client: OpenAI,
  model: string,
  conversationId: string,
  locale: "pt" | "en",
): Promise<void> {
  const total = await prisma.chatMessage.count({ where: { conversationId } });
  if (total < SUMMARY_TRIGGER_COUNT) return;

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { summary: true },
  });

  const older = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: 0,
    take: Math.max(0, total - RECENT_MESSAGE_WINDOW),
    select: { role: true, content: true },
  });
  // Só resume o trecho ainda não coberto pela janela recente.
  const toSummarize = older.slice(-40);
  if (toSummarize.length === 0) return;

  const transcript = toSummarize
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  // Resumo compete pelo mesmo orçamento global de RPM do chat.
  await acquireAiSlot();

  const instruction =
    locale === "pt"
      ? "Resuma a conversa a seguir em até 10 bullets objetivos, preservando decisões, preferências e pendências do usuário. Inclua também os pontos principais do resumo anterior, se houver."
      : "Summarize the following conversation in up to 10 objective bullets, preserving user decisions, preferences and pending items. Also include key points from the previous summary, if any.";

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 500,
    messages: [
      { role: "system", content: instruction },
      {
        role: "user",
        content: `${conversation?.summary ? `RESUMO ANTERIOR:\n${conversation.summary}\n\n` : ""}CONVERSA:\n${transcript}`,
      },
    ],
  });

  const summary = response.choices[0]?.message?.content?.trim();
  if (!summary) return;

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { summary },
  });
}

/**
 * Extração global de fatos duráveis ("prefere treinar de manhã"). Roda
 * periodicamente; falha silenciosamente e nunca bloqueia a conversa.
 */
export async function maybeExtractMemoryFacts(
  client: OpenAI,
  model: string,
  userId: string,
  locale: "pt" | "en",
): Promise<void> {
  const currentCount = await prisma.memoryFact.count({ where: { userId } });
  if (currentCount >= MAX_FACTS) return;

  const recentMessages = await prisma.chatMessage.findMany({
    where: { conversation: { userId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 8,
    select: { role: true, content: true },
  });
  if (recentMessages.length === 0) return;

  const existingFacts = await prisma.memoryFact.findMany({
    where: { userId },
    select: { fact: true },
    orderBy: { updatedAt: "desc" },
  });

  const transcript = recentMessages.reverse().map((m) => `${m.role}: ${m.content}`).join("\n");
  const instruction =
    locale === "pt"
      ? 'Extraia da conversa NOVOS fatos duráveis e estáveis sobre o usuário (preferências, metas, restrições, rotina típica). NÃO inclua fatos transitórios nem os já listados. Responda APENAS um array JSON de strings, ex.: ["fato 1", "fato 2"]. Se não houver nada novo, responda [].'
      : 'Extract NEW durable facts about the user from the conversation (preferences, goals, constraints, typical routine). Do NOT include transient details or already-known facts. Reply ONLY with a JSON array of strings, e.g. ["fact 1"]. If nothing new, reply [].';

  // Extração compete pelo mesmo orçamento global de RPM do chat.
  await acquireAiSlot();

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      { role: "system", content: instruction },
      {
        role: "user",
        content: `FATOS CONHECIDOS:\n${existingFacts.map((f) => `- ${f.fact}`).join("\n") || "(nenhum)"}\n\nCONVERSA:\n${transcript}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const facts = parseFactArray(raw);
  if (facts.length === 0) return;

  const known = new Set(existingFacts.map((f) => f.fact.trim().toLowerCase()));
  const fresh = facts.filter((fact) => !known.has(fact.toLowerCase())).slice(0, 5);
  if (fresh.length === 0) return;

  await prisma.memoryFact.createMany({
    data: fresh.map((fact) => ({ userId, fact, source: "ai" })),
  });
}

/** Parser tolerante: aceita array puro ou cercado por texto/code fence. */
export function parseFactArray(raw: string): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((fact) => fact.trim())
      .filter((fact) => fact.length > 0 && fact.length <= 300)
      .slice(0, MAX_FACTS);
  } catch {
    return [];
  }
}
