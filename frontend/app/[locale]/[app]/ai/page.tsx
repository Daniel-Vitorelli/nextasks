"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, Plus, Send, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  useAiChat,
  useMemoryFacts,
} from "@/hooks/use-ai-chat";
import { ProposalCard } from "@/components/app/ai/proposal-card";
import { toast } from "sonner";

export default function AiPage() {
  const t = useTranslations("app.ai");
  const locale = useLocale();
  const {
    conversations,
    activeId,
    messages,
    proposals,
    isLoadingConversations,
    isStreaming,
    streamError,
    sendMessage,
    stop,
    openConversation,
    newConversation,
    deleteConversation,
    acceptProposal,
    rejectProposal,
  } = useAiChat(locale);

  const memory = useMemoryFacts();
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Rola para o fim quando novas mensagens/chunks ou propostas chegam.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, proposals]);

  const submit = () => {
    if (!draft.trim() || isStreaming) return;
    void sendMessage(draft);
    setDraft("");
  };

  return (
    <main className="mx-auto flex h-[calc(100dvh-4rem)] min-h-[500px] w-full max-w-6xl flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="font-jetbrainsMono text-sm text-muted-foreground uppercase tracking-[0.2em]">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setMemoryOpen(true)}>
          <Brain className="size-4" />
          {t("memory.button")}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:grid lg:grid-cols-[260px_1fr] lg:grid-rows-1">
        {/* Sidebar de conversas */}
        <aside className="flex max-h-[30vh] min-h-0 flex-col gap-2 overflow-y-auto rounded-xl border border-border/60 bg-card p-3 lg:max-h-none">
          <Button type="button" variant="secondary" size="sm" onClick={newConversation}>
            <Plus className="size-4" />
            {t("newChat")}
          </Button>
          {isLoadingConversations ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm",
                  conversation.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => void openConversation(conversation.id)}
                >
                  {conversation.title || t("untitledChat")}
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 opacity-0 transition group-hover:opacity-100"
                  aria-label={t("deleteChat")}
                  onClick={() => void deleteConversation(conversation.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </aside>

        {/* Área de mensagens */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card lg:min-h-0">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 md:p-6">
            {messages.length === 0 && !isStreaming && proposals.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-lg font-semibold">{t("emptyTitle")}</p>
                <p className="text-muted-foreground max-w-md text-sm">{t("emptyDescription")}</p>
              </div>
            ) : (
              <>
                {messages.map((message) => {
                  const relatedProposal = message.proposalId
                    ? proposals.find((p) => p.id === message.proposalId)
                    : null;
                  return (
                    <div key={message.id} className="space-y-2">
                      <div
                        className={cn(
                          "flex w-full",
                          message.role === "user" ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-card-foreground rounded-bl-md",
                          )}
                        >
                          {message.role === "assistant" ? (
                            message.content ? (
                              <MarkdownContent content={message.content} />
                            ) : (
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <Spinner className="size-3" />
                              </span>
                            )
                          ) : (
                            <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</span>
                          )}
                        </div>
                      </div>
                      {relatedProposal && (
                        <div className={cn("flex w-full", "justify-start")}>
                          <ProposalCard
                            proposal={relatedProposal}
                            disabled={actingId === relatedProposal.id || isStreaming}
                            onAccept={async (id) => {
                              setActingId(id);
                              try {
                                await acceptProposal(id);
                                toast.success(t("proposal.toast.accepted"));
                              } catch (e) {
                                toast.error((e as Error).message || t("proposal.toast.error"));
                              } finally {
                                setActingId(null);
                              }
                            }}
                            onReject={async (id) => {
                              setActingId(id);
                              try {
                                await rejectProposal(id);
                                toast.success(t("proposal.toast.rejected"));
                              } catch (e) {
                                toast.error((e as Error).message || t("proposal.toast.error"));
                              } finally {
                                setActingId(null);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Propostas órfãs (pending sem mensagem linkada) */}
                {proposals
                  .filter((p) => p.status === "pending" && !messages.some((m) => m.proposalId === p.id))
                  .map((proposal) => (
                    <div key={proposal.id} className="flex w-full justify-start">
                      <ProposalCard
                        proposal={proposal}
                        disabled={actingId === proposal.id || isStreaming}
                        onAccept={async (id) => {
                          setActingId(id);
                          try {
                            await acceptProposal(id);
                            toast.success(t("proposal.toast.accepted"));
                          } catch (e) {
                            toast.error((e as Error).message || t("proposal.toast.error"));
                          } finally {
                            setActingId(null);
                          }
                        }}
                        onReject={async (id) => {
                          setActingId(id);
                          try {
                            await rejectProposal(id);
                            toast.success(t("proposal.toast.rejected"));
                          } catch (e) {
                            toast.error((e as Error).message || t("proposal.toast.error"));
                          } finally {
                            setActingId(null);
                          }
                        }}
                      />
                    </div>
                  ))}
                {/* Histórico de propostas aceitas/rejeitadas já está no map acima; fallback para mostrar últimas */}
                {proposals.filter((p) => p.status !== "pending").length > 0 &&
                  proposals.filter((p) => p.status !== "pending" && !messages.some((m) => m.proposalId === p.id)).length > 0 && (
                    <div className="space-y-2">
                      {proposals
                        .filter((p) => p.status !== "pending" && !messages.some((m) => m.proposalId === p.id))
                        .slice(0, 2)
                        .map((proposal) => (
                          <div key={proposal.id} className="flex w-full justify-start opacity-70">
                            <ProposalCard proposal={proposal} onAccept={() => {}} onReject={() => {}} disabled />
                          </div>
                        ))}
                    </div>
                  )}
              </>
            )}
            {streamError && (
              <p className="text-destructive text-center text-sm">{t(`errors.${streamError}`)}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-border/60 p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder={t("composerPlaceholder")}
                disabled={isStreaming}
                maxLength={4000}
              />
              {isStreaming ? (
                <Button type="button" size="icon" variant="destructive" onClick={stop}>
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!draft.trim()}>
                  <Send className="size-4" />
                </Button>
              )}
            </form>
          </div>
        </section>
      </div>

      {/* Diálogo de memória */}
      <MemoryDialog
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
        facts={memory.facts}
        isLoading={memory.isLoading}
        onAdd={memory.addFact}
        onRemove={memory.removeFact}
      />
    </main>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words [overflow-wrap:anywhere] [&_a]:underline [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:[overflow-wrap:anywhere] [&_li]:ml-4 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-background/60 [&_pre]:p-2 [&_strong]:font-bold [&_ul]:list-disc">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function MemoryDialog({
  open,
  onOpenChange,
  facts,
  isLoading,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facts: { id: string; fact: string; source: string }[];
  isLoading: boolean;
  onAdd: (fact: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const t = useTranslations("app.ai.memory");
  const [newFact, setNewFact] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!newFact.trim() || saving) return;
    setSaving(true);
    const ok = await onAdd(newFact.trim());
    if (ok) setNewFact("");
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={newFact}
            onChange={(event) => setNewFact(event.target.value)}
            placeholder={t("addPlaceholder")}
            maxLength={300}
          />
          <Button type="submit" size="sm" disabled={!newFact.trim() || saving}>
            {saving ? <Spinner /> : t("add")}
          </Button>
        </form>
        <div className="max-h-[40vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : facts.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border/60 py-6 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            facts.map((fact) => (
              <div
                key={fact.id}
                className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 text-sm"
              >
                <p className="min-w-0 flex-1 break-words">{fact.fact}</p>
                <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide">
                  {fact.source === "manual" ? t("manual") : t("ai")}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-6 shrink-0"
                  aria-label={t("forget")}
                  onClick={() => void onRemove(fact.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
