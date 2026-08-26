"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  interpolate,
  TEMPLATES,
} from "@/lib/notifications/templates";
import {
  useNotificationStream,
  type RealtimeNotification,
} from "@/hooks/use-notification-stream";

const TOAST_TTL_MS = 6000;
const MAX_TOASTS = 3;

interface ToastItem extends RealtimeNotification {
  title: string;
  body: string;
}

/**
 * Escuta o canal em tempo real e mostra toasts in-app clicáveis.
 * Mesmos eventos das pushes — com o site aberto o feedback é instantâneo
 * aqui; com o site fechado quem entrega é a push nativa.
 */
export function NotificationStream() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useNotificationStream(
    useCallback(
      (notification: RealtimeNotification) => {
        const template = TEMPLATES[notification.kind][locale === "pt" ? "pt" : "en"];
        setToasts((current) => [
          ...current.slice(-(MAX_TOASTS - 1)),
          {
            ...notification,
            title: template.title,
            body: interpolate(template.body, notification.params),
          },
        ]);
      },
      [locale],
    ),
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          closeLabel={t("close")}
          onDismiss={() => dismiss(toast.id)}
          onNavigate={(path) => {
            dismiss(toast.id);
            router.push(path);
          }}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  closeLabel,
  onDismiss,
  onNavigate,
}: {
  toast: ToastItem;
  closeLabel: string;
  onDismiss: () => void;
  onNavigate: (path: string) => void;
}) {
  // Auto-dismiss após TTL.
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(onDismiss, 200); // espera a animação de saída
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(close, TOAST_TTL_MS);
    return () => clearTimeout(timer);
  }, [close]);

  return (
    <button
      type="button"
      onClick={() => onNavigate(toast.path)}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-left shadow-lg transition-all duration-200 hover:border-primary/40",
        leaving ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100",
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bell className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{toast.title}</span>
        <span className="text-muted-foreground block break-words text-sm">
          {toast.body}
        </span>
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-label={closeLabel}
        className="text-muted-foreground shrink-0 rounded p-1 text-xs hover:bg-muted"
        onClick={(event) => {
          event.stopPropagation();
          close();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation();
            close();
          }
        }}
      >
        ✕
      </span>
    </button>
  );
}
