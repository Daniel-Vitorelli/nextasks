"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Upload } from "lucide-react";

import type { ImportResult } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { notifyDataChanged } from "@/lib/client/data-events";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DataSection() {
  const t = useTranslations("app.config.data");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  const exportData = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/data/export");
      if (!response.ok) throw new Error("Export failed");
      const payload = await response.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nextasks-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback({ kind: "success", message: t("exportDone") });
    } catch {
      setFeedback({ kind: "error", message: t("exportError") });
    } finally {
      setExporting(false);
    }
  };

  const importData = async (file: File) => {
    setImporting(true);
    setFeedback(null);
    try {
      const text = await file.text();
      const response = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      if (!response.ok) throw new Error("Import failed");
      const result = (await response.json()) as ImportResult;
      // O import cria rotinas/blocos/tarefas: recarrega as telas que
      // mantêm esses dados em cache (dashboard, calendário etc.).
      notifyDataChanged([
        "routines",
        "time-blocks",
        "tasks",
        "subtasks",
        "connections",
        "progress",
      ]);
      setFeedback({
        kind: "success",
        message: t("importDone", {
          routines: result.routines,
          blocks: result.timeBlocks,
          tasks: result.tasks,
          subtasks: result.subtasks,
        }),
      });
    } catch {
      setFeedback({ kind: "error", message: t("importError") });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportData()}
          disabled={exporting}
        >
          {exporting ? <Spinner /> : <Download className="size-4" />}
          {t("export")}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? <Spinner /> : <Upload className="size-4" />}
          {t("import")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importData(file);
          }}
        />

        {feedback && (
          <p
            className={
              feedback.kind === "success"
                ? "text-sm text-muted-foreground"
                : "text-sm text-destructive"
            }
          >
            {feedback.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}