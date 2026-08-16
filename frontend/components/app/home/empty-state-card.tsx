"use client";

import type { ReactNode } from "react";

interface EmptyStateCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

/** Caixa de estado vazio padrão (ícone + título + descrição). */
export function EmptyStateCard({
  icon,
  title,
  description,
}: EmptyStateCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-5">
      <div className="text-muted-foreground size-6 shrink-0">{icon}</div>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}