import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import { parseTaskInput, parseTaskPatch } from "@/lib/validation/tasks";
import { parseHabitInput, parseHabitPatch } from "@/lib/validation/habits";
import { parseRoutineInput } from "@/lib/validation/routines";
import { parseTimeBlockInput, parseTimeBlockPatch } from "@/lib/validation/time-blocks";
import { parseSubtaskInput, parseSubtaskPatch } from "@/lib/validation/subtasks";
import { parseConnectionInput, parseConnectionPatch } from "@/lib/validation/connections";
import { markTaskDoneCascade, markSubtaskDoneCascade } from "@/lib/server/subtask-cascade";
import {
  confirmBlocksForDoneEntities,
  confirmBlocksForHabits,
  reversePropagateForEntities,
} from "@/lib/server/connections";
import { awardXpOnce, xpRefKeys, removeXpForRef, removeXpByEntityPrefix } from "@/lib/server/gamification/xp";
import { XP_AMOUNTS } from "@/lib/gamification/rules";
import { evaluateAchievements } from "@/lib/server/gamification/service";
import { loadGamificationStats } from "@/lib/server/gamification/stats";
import { sendGamificationNotifications } from "@/lib/server/notifications/gamification-hooks";
import { periodForFrequency, startOfDayUtc } from "@/lib/server/completions";

// ---------------------------------------------------------------------------
// Tipos de proposta
// ---------------------------------------------------------------------------

export type ProposalKind =
  | "create_task"
  | "update_task"
  | "complete_task"
  | "delete_task"
  | "create_subtask"
  | "update_subtask"
  | "delete_subtask"
  | "complete_subtask"
  | "create_habit"
  | "update_habit"
  | "delete_habit"
  | "complete_habit"
  | "undo_habit"
  | "create_routine"
  | "update_routine"
  | "delete_routine"
  | "activate_routine"
  | "create_time_block"
  | "update_time_block"
  | "delete_time_block"
  | "complete_time_block"
  | "create_connection"
  | "update_connection"
  | "delete_connection";

export interface ProposalAction {
  id: string;
  kind: ProposalKind;
  params: Record<string, unknown>;
  previewTitle: string;
  previewDescription: string;
  warnings?: string[];
}

export interface ProposalValidation {
  ok: boolean;
  error?: string;
  previewTitle?: string;
  previewDescription?: string;
  warnings?: string[];
  normalizedParams?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Definições de tools para OpenAI/NIM (JSON Schema)
// ---------------------------------------------------------------------------

export const AI_TOOLS: {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}[] = [
  // ---- leituras (auto-exec, sem preview) ----
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Lista as tarefas do usuário (id, título, prazo, prioridade, concluída). Use para descobrir IDs antes de propor alterações.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_habits",
      description: "Lista hábitos do usuário (id, nome, tipo, frequência, meta).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_routines",
      description: "Lista rotinas do usuário (id, nome, frequência, ativa).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_time_blocks",
      description: "Lista blocos de tempo de uma rotina ou todos (id, título, horário, confirmação).",
      parameters: {
        type: "object",
        properties: { routineId: { type: "string", description: "Filtra por rotina (opcional)" } },
        required: [],
      },
    },
  },
  // ---- propostas (preview obrigatório) ----
  {
    type: "function",
    function: {
      name: "propose_create_task",
      description: "Propõe criar uma nova tarefa. Sempre use preview, nunca crie direto.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da tarefa (obrigatório)" },
          description: { type: "string" },
          dueDate: { type: "string", description: "Data limite ISO YYYY-MM-DD ou null" },
          priority: { type: "integer", description: "1 (muito baixa) a 6 (urgente)", minimum: 1, maximum: 6 },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_complete_task",
      description: "Propõe concluir uma tarefa existente (por id ou título).",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "ID da tarefa (preferível)" },
          taskTitle: { type: "string", description: "Título exato ou parcial se não souber o ID" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_task",
      description: "Propõe atualizar título/descrição/prioridade/prazo de uma tarefa.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          taskTitle: { type: "string", description: "Usado para buscar se taskId não informado" },
          title: { type: "string" },
          description: { type: "string" },
          dueDate: { type: "string", description: "YYYY-MM-DD ou null para remover" },
          priority: { type: "integer", minimum: 1, maximum: 6 },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_create_habit",
      description: "Propõe criar um hábito (bom ou ruim). Diário exige dias da semana.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: ["good", "bad"] },
          frequency: { type: "string", enum: ["daily", "weekly"] },
          daysOfWeek: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "0=Domingo ... 6=Sábado, apenas para good+daily" },
          targetCount: { type: "integer", minimum: 1 },
          icon: { type: "string" },
          color: { type: "string", enum: ["red","orange","yellow","green","blue","purple","gray"] },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_complete_habit",
      description: "Propõe confirmar um hábito bom ou registrar recaída de hábito ruim para hoje.",
      parameters: {
        type: "object",
        properties: {
          habitId: { type: "string" },
          habitName: { type: "string", description: "Nome do hábito se não souber o ID" },
          increment: { type: "integer", minimum: 1, description: "Quantidade (default 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_create_routine",
      description:
        "Propõe criar uma rotina COMPLETA com blocos. OBRIGATÓRIO incluir timeBlocks (mínimo 2, ideal 3-5) - rotina sem blocos é inútil e será REJEITADA. Cada bloco deve ter título significativo e realista baseado no propósito da rotina (ex: rotina 'Estudo Concurso' -> blocos 'Matemática', 'Português', 'Revisão', não 'Bloco 1'). Horários em ISO datetime (ex: 2026-08-28T08:00:00.000Z). Para rotina diária use hoje; semanal distribua blocos em dias diferentes. Se usuário não detalhou, INFERIR blocos plausíveis - nunca use títulos genéricos.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          frequency: { type: "string", enum: ["daily","weekly"] },
          duration: { type: "string", enum: ["indefinite","until"] },
          endDate: { type: "string", description: "YYYY-MM-DD se duration=until" },
          timeBlocks: {
            type: "array",
            description: "OBRIGATÓRIO: mínimo 2 blocos com títulos significativos. Exemplo: [{title:'Foco Manhã', start:'2026-08-28T08:00:00.000Z', end:'2026-08-28T09:00:00.000Z', confirmation:'checklist'}]",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título significativo, ex: 'Treino', 'Leitura', 'Meditação' - PROIBIDO 'Bloco 1'" },
                description: { type: "string" },
                start: { type: "string", description: "ISO datetime, ex: 2026-08-28T08:00:00.000Z" },
                end: { type: "string", description: "ISO datetime" },
                isAllDay: { type: "boolean" },
                color: { type: "string", enum: ["red","orange","yellow","green","blue","purple","gray"] },
                confirmation: { type: "string", enum: ["none","checklist","score"] },
              },
              required: ["title","start","end"],
            },
          },
        },
        required: ["name", "timeBlocks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_create_time_block",
      description: "Propõe criar um bloco de tempo em uma rotina existente.",
      parameters: {
        type: "object",
        properties: {
          routineId: { type: "string", description: "ID da rotina" },
          routineName: { type: "string", description: "Nome da rotina se não souber ID" },
          title: { type: "string" },
          description: { type: "string" },
          start: { type: "string", description: "ISO datetime" },
          end: { type: "string", description: "ISO datetime" },
          isAllDay: { type: "boolean" },
          color: { type: "string", enum: ["red","orange","yellow","green","blue","purple","gray"] },
          confirmation: { type: "string", enum: ["none","checklist","score"] },
        },
        required: ["title","start","end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_create_connection",
      description: "Propõe conectar tarefa/subtarefa/hábito a um bloco de tempo.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          subtaskId: { type: "string" },
          habitId: { type: "string" },
          habitName: { type: "string" },
          taskTitle: { type: "string" },
          timeBlockId: { type: "string" },
          timeBlockTitle: { type: "string" },
          requiredCount: { type: "integer", minimum: 1, maximum: 99 },
          dayFilter: { type: "string", description: "all | weekday:N | date:YYYY-MM-DD" },
        },
        required: ["timeBlockId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_delete_task",
      description: "Propõe excluir uma tarefa (e subtarefas). Requer confirmação via preview.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          taskTitle: { type: "string", description: "Título se não souber ID" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_create_subtask",
      description: "Propõe criar subtarefa vinculada a tarefa existente.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          taskTitle: { type: "string", description: "Título da tarefa mãe se não souber ID" },
          parentId: { type: "string", description: "ID da subtarefa mãe (opcional, para aninhar)" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_subtask",
      description: "Propõe atualizar título/descrição de subtarefa.",
      parameters: {
        type: "object",
        properties: {
          subtaskId: { type: "string" },
          subtaskTitle: { type: "string", description: "Título se não souber ID" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_delete_subtask",
      description: "Propõe excluir subtarefa (e filhas).",
      parameters: {
        type: "object",
        properties: {
          subtaskId: { type: "string" },
          subtaskTitle: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_complete_subtask",
      description: "Propõe concluir/reabrir subtarefa.",
      parameters: {
        type: "object",
        properties: {
          subtaskId: { type: "string" },
          subtaskTitle: { type: "string" },
          done: { type: "boolean", description: "true=concluir, false=reabrir (default true)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_habit",
      description: "Propõe atualizar hábito (nome, ícone, cor, tipo, frequência, dias, meta).",
      parameters: {
        type: "object",
        properties: {
          habitId: { type: "string" },
          habitName: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          icon: { type: "string" },
          color: { type: "string", enum: ["red","orange","yellow","green","blue","purple","gray"] },
          type: { type: "string", enum: ["good","bad"] },
          frequency: { type: "string", enum: ["daily","weekly"] },
          daysOfWeek: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
          targetCount: { type: "integer", minimum: 1 },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_delete_habit",
      description: "Propõe excluir hábito.",
      parameters: {
        type: "object",
        properties: {
          habitId: { type: "string" },
          habitName: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_undo_habit",
      description: "Propõe desfazer confirmação/recaída de hoje de um hábito.",
      parameters: {
        type: "object",
        properties: {
          habitId: { type: "string" },
          habitName: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_routine",
      description: "Propõe atualizar rotina (nome, descrição, frequência, duração, data fim).",
      parameters: {
        type: "object",
        properties: {
          routineId: { type: "string" },
          routineName: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          frequency: { type: "string", enum: ["daily","weekly"] },
          duration: { type: "string", enum: ["indefinite","until"] },
          endDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_delete_routine",
      description: "Propõe excluir rotina (e blocos).",
      parameters: {
        type: "object",
        properties: {
          routineId: { type: "string" },
          routineName: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_activate_routine",
      description: "Propõe ativar/desativar rotina (só uma ativa por usuário).",
      parameters: {
        type: "object",
        properties: {
          routineId: { type: "string" },
          routineName: { type: "string" },
          isActive: { type: "boolean", description: "true=ativar, false=desativar" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_time_block",
      description: "Propõe atualizar bloco de tempo (título, horário, cor, confirmação).",
      parameters: {
        type: "object",
        properties: {
          timeBlockId: { type: "string" },
          timeBlockTitle: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          start: { type: "string", description: "ISO datetime" },
          end: { type: "string", description: "ISO datetime" },
          isAllDay: { type: "boolean" },
          color: { type: "string", enum: ["red","orange","yellow","green","blue","purple","gray"] },
          confirmation: { type: "string", enum: ["none","checklist","score"] },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_delete_time_block",
      description: "Propõe excluir bloco de tempo.",
      parameters: {
        type: "object",
        properties: {
          timeBlockId: { type: "string" },
          timeBlockTitle: { type: "string" },
          routineId: { type: "string" },
          routineName: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_complete_time_block",
      description: "Propõe confirmar bloco (checklist true/false ou nota 0-10).",
      parameters: {
        type: "object",
        properties: {
          timeBlockId: { type: "string" },
          timeBlockTitle: { type: "string" },
          value: { type: "string", description: "Para checklist: 'true'/'false'; para score: '0'-'10'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_update_connection",
      description: "Propõe atualizar conexão (requiredCount, dayFilter).",
      parameters: {
        type: "object",
        properties: {
          connectionId: { type: "string" },
          requiredCount: { type: "integer", minimum: 1, maximum: 99 },
          dayFilter: { type: "string", description: "all | weekday:N | date:YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_delete_connection",
      description: "Propõe remover conexão.",
      parameters: {
        type: "object",
        properties: {
          connectionId: { type: "string" },
          taskTitle: { type: "string" },
          timeBlockTitle: { type: "string" },
        },
        required: [],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers de preview / validação
// ---------------------------------------------------------------------------

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function normalizeBlockDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();
  // tenta ISO direto
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime()) && /[T-]/.test(trimmed)) return direct.toISOString();
  // tenta HH:mm ou HH:mm-HH:mm ou "08:00"
  const hm = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const hh = Number(hm[1]);
    const mm = Number(hm[2]);
    if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
      const now = new Date();
      // usa hoje em UTC para não depender de fuso, mas garante data válida
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm, 0, 0));
      return d.toISOString();
    }
  }
  // fallback: tenta Date.parse
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return trimmed;
}

export async function validateProposalAction(
  userId: string,
  kind: ProposalKind,
  rawParams: Record<string, unknown>,
  locale: "pt" | "en" = "pt",
): Promise<ProposalValidation> {
  const pt = locale === "pt";
  try {
    switch (kind) {
      case "create_task": {
        const parsed = parseTaskInput(rawParams);
        if (!parsed) return { ok: false, error: pt ? "Título é obrigatório" : "Title is required" };
        return {
          ok: true,
          previewTitle: pt ? `Criar tarefa "${parsed.title}"` : `Create task "${parsed.title}"`,
          previewDescription: [
            parsed.description ? (pt ? `Descrição: ${parsed.description}` : `Description: ${parsed.description}`) : null,
            parsed.dueDate ? (pt ? `Vence: ${parsed.dueDate.toISOString().slice(0,10)}` : `Due: ${parsed.dueDate.toISOString().slice(0,10)}`) : null,
            `P${parsed.priority}`,
          ].filter(Boolean).join(" • ") || (pt ? "Sem detalhes adicionais" : "No extra details"),
          normalizedParams: { ...parsed, dueDate: parsed.dueDate?.toISOString() ?? null },
        };
      }
      case "complete_task":
      case "update_task":
      case "delete_task": {
        const task = await resolveTask(userId, rawParams);
        if (!task) return { ok: false, error: pt ? "Tarefa não encontrada" : "Task not found" };
        if (kind === "complete_task") {
          if (task.done) return { ok: false, error: pt ? "Tarefa já concluída" : "Task already done" };
          return {
            ok: true,
            previewTitle: pt ? `Concluir tarefa "${task.title}"` : `Complete task "${task.title}"`,
            previewDescription: pt ? "Marcará como concluída e concederá XP" : "Will mark as done and grant XP",
            normalizedParams: { taskId: task.id },
          };
        }
        if (kind === "update_task") {
          const patch: Record<string, unknown> = {};
          if (typeof rawParams.title === "string") patch.title = rawParams.title;
          if (typeof rawParams.description === "string") patch.description = rawParams.description;
          if (rawParams.dueDate !== undefined) patch.dueDate = rawParams.dueDate;
          if (rawParams.priority !== undefined) patch.priority = rawParams.priority;
          const parsed = parseTaskPatch(patch);
          if (!parsed || Object.keys(parsed).length === 0) return { ok: false, error: pt ? "Nenhuma alteração válida" : "No valid changes" };
          const fmt = (k: string, v: unknown) => {
            const oldVal = (task as Record<string, unknown>)[k];
            const oldStr = k === "dueDate" && oldVal ? new Date(oldVal as string).toISOString().slice(0, 10) : String(oldVal ?? "—");
            const newStr = k === "dueDate" && v ? new Date(v as string).toISOString().slice(0, 10) : String(v ?? "—");
            return `${k}: ${oldStr} → ${newStr}`;
          };
          return {
            ok: true,
            previewTitle: pt ? `Atualizar tarefa "${task.title}"` : `Update task "${task.title}"`,
            previewDescription: Object.entries(parsed).map(([k, v]) => fmt(k, v)).join(" • "),
            normalizedParams: { taskId: task.id, patch: { ...parsed, dueDate: parsed.dueDate ? (parsed.dueDate as Date).toISOString() : parsed.dueDate } },
          };
        }
        return { ok: true, previewTitle: `Delete ${task.title}`, previewDescription: "", normalizedParams: { taskId: task.id } };
      }
      case "create_habit": {
        const result = parseHabitInput(rawParams);
        if (!result.ok) return { ok: false, error: result.error };
        return {
          ok: true,
          previewTitle: pt ? `Criar hábito "${result.data.name}"` : `Create habit "${result.data.name}"`,
          previewDescription: `${result.data.type === "bad" ? (pt?"Ruim":"Bad") : (pt?"Bom":"Good")} • ${result.data.frequency} • meta ${result.data.targetCount}`,
          normalizedParams: result.data as unknown as Record<string, unknown>,
        };
      }
      case "complete_habit": {
        const habit = await resolveHabit(userId, rawParams);
        if (!habit) return { ok: false, error: pt ? "Hábito não encontrado" : "Habit not found" };
        return {
          ok: true,
          previewTitle: habit.type === "bad"
            ? (pt ? `Registrar recaída "${habit.name}"` : `Log slip "${habit.name}"`)
            : (pt ? `Confirmar hábito "${habit.name}"` : `Confirm habit "${habit.name}"`),
          previewDescription: habit.type === "bad" ? (pt ? "Hábito ruim: hoje ficará 0%" : "Bad habit: today will be 0%") : `+1 / ${habit.targetCount}`,
          normalizedParams: { habitId: habit.id, increment: typeof rawParams.increment === "number" ? rawParams.increment : 1 },
        };
      }
      case "create_routine": {
        const result = parseRoutineInput(rawParams);
        if (!result.ok) return { ok: false, error: result.error };
        const rawBlocks = Array.isArray(rawParams.timeBlocks) ? (rawParams.timeBlocks as unknown[]) : [];
        if (rawBlocks.length < 2) {
          return {
            ok: false,
            error: pt
              ? "Rotina precisa de pelo menos 2 blocos com títulos significativos (ex: 'Treino', 'Leitura'). Inclua timeBlocks com start/end em ISO e títulos reais, não 'Bloco 1'."
              : "Routine needs at least 2 blocks with meaningful titles. Include timeBlocks with ISO start/end and real titles, not 'Block 1'.",
          };
        }
        const normalizedBlocks: Record<string, unknown>[] = [];
        const warnings: string[] = [];
        for (let i = 0; i < rawBlocks.length; i++) {
          const b = rawBlocks[i] as Record<string, unknown>;
          const title = typeof b.title === "string" ? b.title.trim() : "";
          if (!title || /^bloco\s*\d+$/i.test(title) || /^block\s*\d+$/i.test(title)) {
            return {
              ok: false,
              error: pt
                ? `Bloco ${i + 1} com título genérico "${title}" — use nomes significativos como "Treino", "Meditação", "Estudo" (proibido "Bloco 1/2/3").`
                : `Block ${i + 1} generic title "${title}" — use meaningful names like "Workout", "Meditation" (forbidden "Block 1/2/3").`,
            };
          }
          const parsed = parseTimeBlockInput({
            title: b.title,
            description: b.description,
            start: normalizeBlockDate(b.start),
            end: normalizeBlockDate(b.end),
            isAllDay: b.isAllDay,
            color: b.color,
            confirmation: b.confirmation ?? "checklist",
          });
          if (!parsed) {
            warnings.push(pt ? `Bloco ${i + 1} ignorado (horário inválido)` : `Block ${i + 1} ignored (invalid time)`);
            continue;
          }
          normalizedBlocks.push({
            title: parsed.title,
            description: parsed.description,
            start: parsed.start.toISOString(),
            end: parsed.end.toISOString(),
            isAllDay: parsed.isAllDay,
            color: parsed.color,
            confirmation: parsed.confirmation,
          });
        }
        if (normalizedBlocks.length < 2) {
          return {
            ok: false,
            error: pt
              ? `Só ${normalizedBlocks.length} bloco(s) válido(s) — são necessários pelo menos 2. Verifique start/end em ISO (ex: 2026-08-28T08:00:00.000Z) e títulos significativos.`
              : `Only ${normalizedBlocks.length} valid block(s) — at least 2 required. Check ISO start/end and meaningful titles.`,
          };
        }
        const fmtTime = (iso: string) => {
          const d = new Date(iso);
          return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
        };
        const fmtBlock = (b: Record<string, unknown>) => {
          const s = b.start as string;
          const e = b.end as string;
          const isAllDay = b.isAllDay as boolean;
          const title = b.title as string;
          if (isAllDay) return `${title} (dia todo)`;
          return `${fmtTime(s)}-${fmtTime(e)} ${title}`;
        };
        const previewDesc = [
          `${result.data.frequency} • ${result.data.duration}`,
          pt ? `${normalizedBlocks.length} bloco(s)` : `${normalizedBlocks.length} block(s)`,
          normalizedBlocks.map(fmtBlock).join(" • "),
        ]
          .filter(Boolean)
          .join(" • ");
        return {
          ok: true,
          previewTitle: pt ? `Criar rotina "${result.data.name}"` : `Create routine "${result.data.name}"`,
          previewDescription: previewDesc,
          warnings: warnings.length ? warnings : undefined,
          normalizedParams: { ...result.data, endDate: result.data.endDate?.toISOString() ?? null, timeBlocks: normalizedBlocks },
        };
      }
      case "create_time_block": {
        // Resolve routine
        let routineId = typeof rawParams.routineId === "string" ? rawParams.routineId : null;
        if (!routineId && typeof rawParams.routineName === "string") {
          const r = await prisma.routine.findFirst({ where: { userId, name: rawParams.routineName as string }, select: { id: true } });
          if (r) routineId = r.id;
        }
        if (!routineId) return { ok: false, error: pt ? "Rotina não encontrada" : "Routine not found" };
        const routine = await prisma.routine.findFirst({ where: { id: routineId, userId } });
        if (!routine) return { ok: false, error: pt ? "Rotina não encontrada" : "Routine not found" };
        const parsed = parseTimeBlockInput({ ...rawParams, title: rawParams.title, start: rawParams.start, end: rawParams.end });
        if (!parsed) return { ok: false, error: pt ? "Bloco inválido (título e horários obrigatórios)" : "Invalid block" };
        return {
          ok: true,
          previewTitle: pt ? `Criar bloco "${parsed.title}" em "${routine.name}"` : `Create block "${parsed.title}" in "${routine.name}"`,
          previewDescription: `${parsed.start.toISOString()} → ${parsed.end.toISOString()} • ${parsed.confirmation}`,
          normalizedParams: { ...parsed, start: parsed.start.toISOString(), end: parsed.end.toISOString(), routineId },
        };
      }
      case "create_connection": {
        // resolve ids from titles/names if missing
        // eslint-disable-next-line prefer-const
        let { taskId, subtaskId, habitId, timeBlockId } = rawParams as Record<string, string>;
        if (!habitId && typeof rawParams.habitName === "string") {
          const h = await prisma.habit.findFirst({ where: { userId, name: rawParams.habitName as string }, select: { id: true } });
          if (h) habitId = h.id;
        }
        if (!taskId && typeof rawParams.taskTitle === "string") {
          const t = await prisma.task.findFirst({ where: { userId, title: rawParams.taskTitle as string }, select: { id: true } });
          if (t) taskId = t.id;
        }
        if (!timeBlockId && typeof rawParams.timeBlockTitle === "string") {
          const b = await prisma.timeBlock.findFirst({ where: { routine: { userId }, title: rawParams.timeBlockTitle as string }, select: { id: true } });
          if (b) timeBlockId = b.id;
        }
        const input = parseConnectionInput({ taskId: taskId ?? null, subtaskId: subtaskId ?? null, habitId: habitId ?? null, timeBlockId, requiredCount: rawParams.requiredCount ?? 1, dayFilter: rawParams.dayFilter ?? "all" });
        if (!input) return { ok: false, error: pt ? "Conexão inválida (exatamente uma entidade + bloco)" : "Invalid connection" };
        // valida existência e regras adicionais superficialmente para preview
        const block = await prisma.timeBlock.findFirst({ where: { id: input.timeBlockId, routine: { userId } }, include: { routine: true } });
        if (!block) return { ok: false, error: pt ? "Bloco não encontrado" : "Block not found" };
        if (block.confirmation === "none") return { ok: false, error: pt ? "Bloco sem confirmação não pode ser conectado" : "Block has no confirmation" };
        if (!block.routine.isActive) return { ok: false, error: pt ? "Rotina inativa" : "Routine inactive" };
        if (input.habitId) {
          const h = await prisma.habit.findFirst({ where: { id: input.habitId, userId } });
          if (!h) return { ok: false, error: pt ? "Hábito não encontrado" : "Habit not found" };
          if (h.type === "bad") return { ok: false, error: pt ? "Hábitos ruins não participam de conexões" : "Bad habits cannot be connected" };
        }
        return {
          ok: true,
          previewTitle: pt ? `Conectar ${input.taskId ? "tarefa" : input.subtaskId ? "subtarefa" : "hábito"} ao bloco "${block.title}"` : `Connect ${input.taskId ? "task" : input.subtaskId ? "subtask" : "habit"} to block "${block.title}"`,
          previewDescription: `requiredCount ${input.requiredCount} • ${input.dayFilter}`,
          normalizedParams: input as unknown as Record<string, unknown>,
        };
      }
      case "create_subtask": {
        const title = typeof rawParams.title === "string" ? rawParams.title.trim() : "";
        if (!title) return { ok: false, error: pt ? "Título da subtarefa obrigatório" : "Subtask title required" };
        let taskId = typeof rawParams.taskId === "string" ? rawParams.taskId : null;
        if (!taskId && typeof rawParams.taskTitle === "string") {
          const t = await prisma.task.findFirst({ where: { userId, title: rawParams.taskTitle as string }, select: { id: true } });
          if (t) taskId = t.id;
        }
        if (!taskId) return { ok: false, error: pt ? "Tarefa mãe não encontrada" : "Parent task not found" };
        const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
        if (!task) return { ok: false, error: pt ? "Tarefa não encontrada" : "Task not found" };
        if (rawParams.parentId) {
          const parent = await prisma.subtask.findFirst({ where: { id: rawParams.parentId as string, taskId } });
          if (!parent) return { ok: false, error: pt ? "Subtarefa mãe não encontrada" : "Parent subtask not found" };
        }
        const parsed = parseSubtaskInput({ title, description: rawParams.description });
        if (!parsed) return { ok: false, error: pt ? "Subtarefa inválida" : "Invalid subtask" };
        return {
          ok: true,
          previewTitle: pt ? `Criar subtarefa "${parsed.title}" em "${task.title}"` : `Create subtask "${parsed.title}" in "${task.title}"`,
          previewDescription: parsed.description ? parsed.description.slice(0, 60) : (pt ? "Sem descrição" : "No description"),
          normalizedParams: { taskId, parentId: (rawParams.parentId as string) || null, title: parsed.title, description: parsed.description },
        };
      }
      case "update_subtask":
      case "delete_subtask":
      case "complete_subtask": {
        const subtask = await resolveSubtask(userId, rawParams);
        if (!subtask) return { ok: false, error: pt ? "Subtarefa não encontrada" : "Subtask not found" };
        if (kind === "delete_subtask") {
          return {
            ok: true,
            previewTitle: pt ? `Excluir subtarefa "${subtask.title}"` : `Delete subtask "${subtask.title}"`,
            previewDescription: pt ? "Removerá também filhas" : "Will also remove children",
            normalizedParams: { subtaskId: subtask.id },
          };
        }
        if (kind === "complete_subtask") {
          const done = rawParams.done !== false;
          return {
            ok: true,
            previewTitle: done ? (pt ? `Concluir subtarefa "${subtask.title}"` : `Complete subtask "${subtask.title}"`) : (pt ? `Reabrir subtarefa "${subtask.title}"` : `Reopen subtask "${subtask.title}"`),
            previewDescription: done ? (pt ? "Marcará concluída + cascata" : "Reabrirá ancestrais") : "",
            normalizedParams: { subtaskId: subtask.id, done },
          };
        }
        // update
        const patch: Record<string, unknown> = {};
        if (typeof rawParams.title === "string") patch.title = rawParams.title;
        if (typeof rawParams.description === "string") patch.description = rawParams.description;
        const parsed = parseSubtaskPatch(patch);
        if (!parsed || Object.keys(parsed).length === 0) return { ok: false, error: pt ? "Nenhuma alteração válida" : "No valid changes" };
        const fmtSub = (k: string, v: unknown) => {
          const oldVal = (subtask as Record<string, unknown>)[k];
          return `${k}: ${String(oldVal ?? "—")} → ${String(v ?? "—")}`;
        };
        return {
          ok: true,
          previewTitle: pt ? `Atualizar subtarefa "${subtask.title}"` : `Update subtask "${subtask.title}"`,
          previewDescription: Object.entries(parsed).map(([k, v]) => fmtSub(k, v)).join(" • "),
          normalizedParams: { subtaskId: subtask.id, patch: parsed },
        };
      }
      case "update_habit":
      case "delete_habit":
      case "undo_habit": {
        const habit = await resolveHabit(userId, rawParams);
        if (!habit) return { ok: false, error: pt ? "Hábito não encontrado" : "Habit not found" };
        if (kind === "delete_habit") {
          return {
            ok: true,
            previewTitle: pt ? `Excluir hábito "${habit.name}"` : `Delete habit "${habit.name}"`,
            previewDescription: `${habit.type} • ${habit.frequency}`,
            normalizedParams: { habitId: habit.id },
          };
        }
        if (kind === "undo_habit") {
          return {
            ok: true,
            previewTitle: pt ? `Desfazer hoje "${habit.name}"` : `Undo today "${habit.name}"`,
            previewDescription: pt ? "Removerá registro de hoje" : "Will remove today record",
            normalizedParams: { habitId: habit.id },
          };
        }
        // update
        const patchInput: Record<string, unknown> = {};
        if (rawParams.name !== undefined) patchInput.name = rawParams.name;
        if (rawParams.description !== undefined) patchInput.description = rawParams.description;
        if (rawParams.icon !== undefined) patchInput.icon = rawParams.icon;
        if (rawParams.color !== undefined) patchInput.color = rawParams.color;
        if (rawParams.type !== undefined) patchInput.type = rawParams.type;
        if (rawParams.frequency !== undefined) patchInput.frequency = rawParams.frequency;
        if (rawParams.daysOfWeek !== undefined) patchInput.daysOfWeek = rawParams.daysOfWeek;
        if (rawParams.targetCount !== undefined) patchInput.targetCount = rawParams.targetCount;
        const result = parseHabitPatch(patchInput);
        if (!result.ok) return { ok: false, error: result.error };
        if (Object.keys(result.data).length === 0) return { ok: false, error: pt ? "Nenhuma alteração" : "No changes" };
        const fmtHabit = (k: string, v: unknown) => {
          const oldVal = (habit as Record<string, unknown>)[k];
          const oldStr = k === "daysOfWeek" ? JSON.stringify(oldVal) : String(oldVal ?? "—");
          const newStr = k === "daysOfWeek" ? JSON.stringify(v) : String(v ?? "—");
          return `${k}: ${oldStr} → ${newStr}`;
        };
        return {
          ok: true,
          previewTitle: pt ? `Atualizar hábito "${habit.name}"` : `Update habit "${habit.name}"`,
          previewDescription: Object.entries(result.data).map(([k, v]) => fmtHabit(k, v)).join(" • "),
          normalizedParams: { habitId: habit.id, patch: result.data },
        };
      }
      case "update_routine":
      case "delete_routine":
      case "activate_routine": {
        const routine = await resolveRoutine(userId, rawParams);
        if (!routine) return { ok: false, error: pt ? "Rotina não encontrada" : "Routine not found" };
        if (kind === "delete_routine") {
          return {
            ok: true,
            previewTitle: pt ? `Excluir rotina "${routine.name}"` : `Delete routine "${routine.name}"`,
            previewDescription: `${routine.frequency} • ${routine.isActive ? (pt ? "ativa" : "active") : (pt ? "inativa" : "inactive")}`,
            normalizedParams: { routineId: routine.id },
          };
        }
        if (kind === "activate_routine") {
          const desired = rawParams.isActive !== undefined ? !!rawParams.isActive : !routine.isActive;
          return {
            ok: true,
            previewTitle: desired ? (pt ? `Ativar rotina "${routine.name}"` : `Activate routine "${routine.name}"`) : (pt ? `Desativar rotina "${routine.name}"` : `Deactivate routine "${routine.name}"`),
            previewDescription: desired ? (pt ? "Desativará outras rotinas" : "Will deactivate others") : "",
            normalizedParams: { routineId: routine.id, isActive: desired },
          };
        }
        // update
        const patch: Record<string, unknown> = {};
        if (typeof rawParams.name === "string") patch.name = rawParams.name;
        if (typeof rawParams.description === "string") patch.description = rawParams.description;
        if (typeof rawParams.frequency === "string") patch.frequency = rawParams.frequency;
        if (typeof rawParams.duration === "string") patch.duration = rawParams.duration;
        if (rawParams.endDate !== undefined) patch.endDate = rawParams.endDate;
        // valida minimamente via parseRoutineInput parcial
        if (patch.name !== undefined && !(typeof patch.name === "string" && patch.name.trim())) return { ok: false, error: pt ? "Nome inválido" : "Invalid name" };
        if (Object.keys(patch).length === 0) return { ok: false, error: pt ? "Nenhuma alteração" : "No changes" };
        const fmtRoutine = (k: string, v: unknown) => {
          const oldVal = (routine as Record<string, unknown>)[k];
          const oldStr = k === "endDate" && oldVal ? new Date(oldVal as string).toISOString().slice(0, 10) : String(oldVal ?? "—");
          const newStr = k === "endDate" && v ? new Date(v as string).toISOString().slice(0, 10) : String(v ?? "—");
          return `${k}: ${oldStr} → ${newStr}`;
        };
        return {
          ok: true,
          previewTitle: pt ? `Atualizar rotina "${routine.name}"` : `Update routine "${routine.name}"`,
          previewDescription: Object.entries(patch).map(([k, v]) => fmtRoutine(k, v)).join(" • ") || (pt ? "Sem alterações" : "No changes"),
          normalizedParams: { routineId: routine.id, patch },
        };
      }
      case "update_time_block":
      case "delete_time_block":
      case "complete_time_block": {
        const block = await resolveTimeBlock(userId, rawParams);
        if (!block) return { ok: false, error: pt ? "Bloco não encontrado" : "Block not found" };
        if (kind === "delete_time_block") {
          return {
            ok: true,
            previewTitle: pt ? `Excluir bloco "${block.title}"` : `Delete block "${block.title}"`,
            previewDescription: `${block.routine.name} • ${block.confirmation}`,
            normalizedParams: { timeBlockId: block.id },
          };
        }
        if (kind === "complete_time_block") {
          const value = typeof rawParams.value === "string" ? rawParams.value : "true";
          const mode = block.confirmation as string;
          const valid = mode === "checklist" ? value === "true" || value === "false" : !isNaN(parseInt(value, 10));
          if (!valid) return { ok: false, error: pt ? "Valor inválido para o modo do bloco" : "Invalid value for block mode" };
          return {
            ok: true,
            previewTitle: pt ? `Confirmar bloco "${block.title}"` : `Confirm block "${block.title}"`,
            previewDescription: mode === "checklist" ? (value === "true" ? "✓" : "✗") : `Nota ${value}/10`,
            normalizedParams: { timeBlockId: block.id, value },
          };
        }
        // update
        const patch: Record<string, unknown> = {};
        if (typeof rawParams.title === "string") patch.title = rawParams.title;
        if (typeof rawParams.description === "string") patch.description = rawParams.description;
        if (rawParams.start !== undefined) patch.start = normalizeBlockDate(rawParams.start);
        if (rawParams.end !== undefined) patch.end = normalizeBlockDate(rawParams.end);
        if (rawParams.isAllDay !== undefined) patch.isAllDay = rawParams.isAllDay;
        if (rawParams.color !== undefined) patch.color = rawParams.color;
        if (rawParams.confirmation !== undefined) patch.confirmation = rawParams.confirmation;
        const parsed = parseTimeBlockPatch(patch);
        if (!parsed || Object.keys(parsed).length === 0) return { ok: false, error: pt ? "Nenhuma alteração válida" : "No valid changes" };
        const fmtBlock = (k: string, v: unknown) => {
          const oldVal = (block as Record<string, unknown>)[k];
          const fmtVal = (val: unknown) => {
            if (k === "start" || k === "end") {
              const d = val ? new Date(val as string) : oldVal ? new Date(oldVal as string) : null;
              return d ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` : String(val ?? "—");
            }
            return String(val ?? "—");
          };
          const oldStr = fmtVal(oldVal);
          const newStr = fmtVal(v);
          return `${k}: ${oldStr} → ${newStr}`;
        };
        return {
          ok: true,
          previewTitle: pt ? `Atualizar bloco "${block.title}"` : `Update block "${block.title}"`,
          previewDescription: Object.entries(parsed).map(([k, v]) => fmtBlock(k, v)).join(" • "),
          normalizedParams: { timeBlockId: block.id, patch: { ...parsed, start: parsed.start?.toISOString(), end: parsed.end?.toISOString() } },
        };
      }
      case "update_connection":
      case "delete_connection": {
        const conn = await resolveConnection(userId, rawParams);
        if (!conn) return { ok: false, error: pt ? "Conexão não encontrada" : "Connection not found" };
        if (kind === "delete_connection") {
          return {
            ok: true,
            previewTitle: pt ? `Remover conexão` : `Remove connection`,
            previewDescription: `${conn.taskId ? "task" : conn.subtaskId ? "subtask" : "habit"} ↔ ${conn.timeBlock.title}`,
            normalizedParams: { connectionId: conn.id },
          };
        }
        const patch: Record<string, unknown> = {};
        if (rawParams.requiredCount !== undefined) patch.requiredCount = rawParams.requiredCount;
        if (rawParams.dayFilter !== undefined) patch.dayFilter = rawParams.dayFilter;
        const parsed = parseConnectionPatch(patch);
        if (!parsed) return { ok: false, error: pt ? "Patch inválido" : "Invalid patch" };
        const fmtConn = (k: string, v: unknown) => {
          const oldVal = (conn as Record<string, unknown>)[k];
          return `${k}: ${String(oldVal ?? "—")} → ${String(v ?? "—")}`;
        };
        return {
          ok: true,
          previewTitle: pt ? `Atualizar conexão` : `Update connection`,
          previewDescription: Object.entries(parsed).map(([k, v]) => fmtConn(k, v)).join(" • "),
          normalizedParams: { connectionId: conn.id, patch: parsed },
        };
      }
      default:
        return { ok: false, error: "Unsupported action" };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Validation error" };
  }
}

async function resolveTask(userId: string, params: Record<string, unknown>) {
  if (typeof params.taskId === "string") {
    return prisma.task.findFirst({ where: { id: params.taskId as string, userId } });
  }
  if (typeof params.taskTitle === "string") {
    const t = params.taskTitle as string;
    return (await prisma.task.findFirst({ where: { userId, title: t } })) || (await prisma.task.findFirst({ where: { userId, title: { contains: t } } }));
  }
  return null;
}
async function resolveHabit(userId: string, params: Record<string, unknown>) {
  if (typeof params.habitId === "string") return prisma.habit.findFirst({ where: { id: params.habitId as string, userId } });
  if (typeof params.habitName === "string") {
    const n = params.habitName as string;
    return (await prisma.habit.findFirst({ where: { userId, name: n } })) || (await prisma.habit.findFirst({ where: { userId, name: { contains: n } } }));
  }
  return null;
}
async function resolveSubtask(userId: string, params: Record<string, unknown>) {
  if (typeof params.subtaskId === "string") {
    return prisma.subtask.findFirst({ where: { id: params.subtaskId as string, task: { userId } }, include: { task: true } }).then((s) => (s ? { ...s, title: s.title } : null));
  }
  if (typeof params.subtaskTitle === "string") {
    const t = params.subtaskTitle as string;
    return (await prisma.subtask.findFirst({ where: { title: t, task: { userId } } })) || (await prisma.subtask.findFirst({ where: { title: { contains: t }, task: { userId } } }));
  }
  return null;
}
async function resolveRoutine(userId: string, params: Record<string, unknown>) {
  if (typeof params.routineId === "string") return prisma.routine.findFirst({ where: { id: params.routineId as string, userId } });
  if (typeof params.routineName === "string") {
    const n = params.routineName as string;
    return (await prisma.routine.findFirst({ where: { userId, name: n } })) || (await prisma.routine.findFirst({ where: { userId, name: { contains: n } } }));
  }
  return null;
}
async function resolveTimeBlock(userId: string, params: Record<string, unknown>) {
  if (typeof params.timeBlockId === "string") return prisma.timeBlock.findFirst({ where: { id: params.timeBlockId as string, routine: { userId } }, include: { routine: true } });
  if (typeof params.timeBlockTitle === "string") {
    const t = params.timeBlockTitle as string;
    const byExact = await prisma.timeBlock.findFirst({ where: { title: t, routine: { userId } }, include: { routine: true } });
    if (byExact) return byExact;
    return prisma.timeBlock.findFirst({ where: { title: { contains: t }, routine: { userId } }, include: { routine: true } });
  }
  if (typeof params.routineName === "string" && typeof params.title === "string") {
    // tenta buscar por rotina + título
    const r = await prisma.routine.findFirst({ where: { userId, name: params.routineName as string } });
    if (r) return prisma.timeBlock.findFirst({ where: { routineId: r.id, title: params.title as string }, include: { routine: true } });
  }
  return null;
}
async function resolveConnection(userId: string, params: Record<string, unknown>) {
  if (typeof params.connectionId === "string") return prisma.taskBlockConnection.findFirst({ where: { id: params.connectionId as string, userId }, include: { timeBlock: { include: { routine: true } } } });
  // tenta por títulos
  if (typeof params.taskTitle === "string" && typeof params.timeBlockTitle === "string") {
    const task = await prisma.task.findFirst({ where: { userId, title: params.taskTitle as string } });
    const block = await prisma.timeBlock.findFirst({ where: { title: params.timeBlockTitle as string, routine: { userId } } });
    if (task && block) return prisma.taskBlockConnection.findFirst({ where: { userId, taskId: task.id, timeBlockId: block.id }, include: { timeBlock: { include: { routine: true } } } });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Execução transacional (chamado no accept)
// ---------------------------------------------------------------------------

export async function executeProposalAction(
  tx: Prisma.TransactionClient,
  userId: string,
  action: ProposalAction,
  tzOffsetMinutes: number,
): Promise<{ kind: string; refId?: string }> {
  const p = action.params as Record<string, unknown>;
  switch (action.kind) {
    case "create_task": {
      const parsed = parseTaskInput({ title: p.title, description: p.description, dueDate: p.dueDate as string | null, priority: p.priority });
      if (!parsed) throw new Error("Invalid task");
      const task = await tx.task.create({ data: { userId, title: parsed.title, description: parsed.description, dueDate: parsed.dueDate, priority: parsed.priority } as never });
      return { kind: "tasks", refId: task.id };
    }
    case "complete_task": {
      const taskId = p.taskId as string;
      const existing = await tx.task.findFirst({ where: { id: taskId, userId } });
      if (!existing) throw new Error("Task not found");
      if (existing.done) return { kind: "tasks" };
      const { completedSubtaskIds, taskCompleted } = await markTaskDoneCascade(tx, taskId, existing.done);
      if (taskCompleted || completedSubtaskIds.length > 0) {
        await confirmBlocksForDoneEntities(tx, taskCompleted ? [taskId] : [], completedSubtaskIds, tzOffsetMinutes);
      }
      if (taskCompleted) await awardXpOnce(tx, userId, "task.done", XP_AMOUNTS.taskDone, xpRefKeys.taskDone(taskId));
      for (const sid of completedSubtaskIds) await awardXpOnce(tx, userId, "subtask.done", XP_AMOUNTS.subtaskDone, xpRefKeys.subtaskDone(sid));
      await tx.task.update({ where: { id: taskId }, data: { done: true } });
      const stats = await loadGamificationStats(tx, userId, tzOffsetMinutes);
      const newly = await evaluateAchievements(tx, userId, stats);
      await sendGamificationNotifications(userId, { newlyUnlockedAchievements: newly });
      return { kind: "tasks", refId: taskId };
    }
    case "update_task": {
      const taskId = p.taskId as string;
      const patchRaw = p.patch as Record<string, unknown> ?? p;
      const parsed = parseTaskPatch({ ...patchRaw, dueDate: patchRaw.dueDate ? new Date(patchRaw.dueDate as string).toISOString() : patchRaw.dueDate });
      if (!parsed) throw new Error("Invalid patch");
      // handle dueDate string conversion
      if (typeof parsed.dueDate === "string") parsed.dueDate = new Date(parsed.dueDate as unknown as string) as unknown as Date;
      await tx.task.update({ where: { id: taskId }, data: parsed as never });
      return { kind: "tasks", refId: taskId };
    }
    case "create_habit": {
      const result = parseHabitInput(p);
      if (!result.ok) throw new Error(result.error);
      const habit = await tx.habit.create({ data: { userId, ...result.data } as never });
      return { kind: "habits", refId: habit.id };
    }
    case "complete_habit": {
      const habitId = p.habitId as string;
      const habit = await tx.habit.findFirst({ where: { id: habitId, userId } });
      if (!habit) throw new Error("Habit not found");
      const increment = typeof p.increment === "number" ? p.increment : 1;
      const now = new Date();
      const dayStart = startOfDayUtc(now, tzOffsetMinutes);
      const weekStart = new Date(dayStart.getTime() - new Date(now.getTime() - tzOffsetMinutes * 60000).getUTCDay() * 86400000);
      // Upsert logic simplificada similar a POST /habits/:id/complete
      const isBad = habit.type === "bad";
      const isWeekly = habit.frequency === "weekly";
      // Para semanal, agregamos na semana: usamos dayStart mas periodCount é semana
      // Aqui fazemos upsert do dia (bad ou good daily) ou soma semanal via count
      if (habitId) {
        // check existing
        const existing = await tx.habitCompletion.findUnique({ where: { habitId_date: { habitId, date: dayStart } } as never });
        if (existing) {
          const newCount = isBad ? existing.count + increment : Math.min(habit.targetCount, existing.count + increment);
          await tx.habitCompletion.update({ where: { id: existing.id }, data: { count: newCount } });
        } else {
          await tx.habitCompletion.create({ data: { habitId, userId, date: dayStart, count: isBad ? increment : Math.min(habit.targetCount, increment), source: "explicit" } as never });
        }
        // XP
        if (isBad) {
          await awardXpOnce(tx, userId, "habit.slip", XP_AMOUNTS.habitSlip, xpRefKeys.habitSlip(habitId, dayStart.getTime()));
        } else {
          await awardXpOnce(tx, userId, "habit.confirm", XP_AMOUNTS.habitConfirm, xpRefKeys.habitConfirm(habitId, dayStart.getTime()));
          // check target reached
          const completions = await tx.habitCompletion.findMany({ where: { habitId, userId, date: { gte: isWeekly ? weekStart : dayStart } } });
          const total = completions.reduce((a, c) => a + c.count, 0) + (existing ? 0 : increment); // simplified
          if (total >= habit.targetCount) {
            const windowStart = isWeekly ? weekStart.getTime() : dayStart.getTime();
            await awardXpOnce(tx, userId, "habit.target", XP_AMOUNTS.habitTargetBonus, xpRefKeys.habitTarget(habitId, windowStart));
          }
          await confirmBlocksForHabits(tx, userId, [habitId], tzOffsetMinutes);
        }
        const stats = await loadGamificationStats(tx, userId, tzOffsetMinutes);
        const newly = await evaluateAchievements(tx, userId, stats);
        await sendGamificationNotifications(userId, { newlyUnlockedAchievements: newly });
      }
      return { kind: "habits", refId: habitId };
    }
    case "create_routine": {
      const parsed = parseRoutineInput(p);
      if (!parsed.ok) throw new Error(parsed.error);
      const routine = await tx.routine.create({ data: { userId, name: parsed.data.name, description: parsed.data.description, frequency: parsed.data.frequency, duration: parsed.data.duration, endDate: parsed.data.endDate } as never });
      // Cria blocos embarcados — validação já garante >=2 blocos válidos com títulos significativos
      const embedded = Array.isArray(p.timeBlocks) ? (p.timeBlocks as Record<string, unknown>[]) : [];
      if (embedded.length === 0) throw new Error("Routine must have at least 2 timeBlocks");
      // Para rotinas semanais, distribui blocos em weekdays diferentes se todos caíram no mesmo dia
      const isWeekly = parsed.data.frequency === "weekly";
      let baseDate: Date | null = null;
      if (isWeekly && embedded.length > 1) {
        const firstStart = embedded[0].start ? new Date(embedded[0].start as string) : null;
        if (firstStart && !isNaN(firstStart.getTime())) baseDate = firstStart;
      }
      for (let idx = 0; idx < embedded.length; idx++) {
        const raw = embedded[idx];
        let startStr = raw.start as string | undefined;
        let endStr = raw.end as string | undefined;
        // Distribui semanal: cada bloco vai para um weekday diferente a partir do base
        if (isWeekly && baseDate && startStr && endStr) {
          const s = new Date(startStr);
          const e = new Date(endStr);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
            const offsetDays = idx;
            const newStart = new Date(s.getTime() + offsetDays * 24 * 60 * 60 * 1000);
            const newEnd = new Date(e.getTime() + offsetDays * 24 * 60 * 60 * 1000);
            startStr = newStart.toISOString();
            endStr = newEnd.toISOString();
          }
        }
        // Auto-cor: se não fornecida ou genérica, infere pelo título
        let color = raw.color as string | undefined;
        if (!color || !["red","orange","yellow","green","blue","purple","gray"].includes(color)) {
          const t = (raw.title as string || "").toLowerCase();
          if (t.includes("treino") || t.includes("academia") || t.includes("corrida")) color = "red";
          else if (t.includes("medita") || t.includes("yoga") || t.includes("respira")) color = "purple";
          else if (t.includes("estudo") || t.includes("leitura") || t.includes("foco")) color = "blue";
          else if (t.includes("trabalho") || t.includes("reunião")) color = "orange";
          else if (t.includes("sono") || t.includes("descanso")) color = "gray";
          else color = ["green","blue","purple","orange","red"][idx % 5];
        }
        const parsedBlock = parseTimeBlockInput({
          title: raw.title,
          description: raw.description,
          start: startStr,
          end: endStr,
          isAllDay: raw.isAllDay,
          color,
          confirmation: (raw.confirmation as string) ?? "checklist",
        });
        if (!parsedBlock) throw new Error(`Invalid time block: ${JSON.stringify(raw)}`);
        await tx.timeBlock.create({
          data: {
            routineId: routine.id,
            title: parsedBlock.title,
            description: parsedBlock.description,
            start: parsedBlock.start,
            end: parsedBlock.end,
            isAllDay: parsedBlock.isAllDay,
            color: parsedBlock.color,
            confirmation: parsedBlock.confirmation,
          } as never,
        });
      }
      // Ativa automaticamente a nova rotina (desativa antigas) para que apareça na Home/Calendário
      await tx.routine.updateMany({ where: { userId, id: { not: routine.id } }, data: { isActive: false } });
      await tx.routine.update({ where: { id: routine.id }, data: { isActive: true } });
      return { kind: "routines", refId: routine.id };
    }
    case "create_time_block": {
      const routineId = p.routineId as string;
      const parsed = parseTimeBlockInput({ title: p.title, description: p.description, start: p.start as string | undefined, end: p.end as string | undefined, isAllDay: p.isAllDay, color: p.color, confirmation: p.confirmation });
      if (!parsed) throw new Error("Invalid time block");
      const block = await tx.timeBlock.create({ data: { routineId, title: parsed.title, description: parsed.description, start: parsed.start, end: parsed.end, isAllDay: parsed.isAllDay, color: parsed.color, confirmation: parsed.confirmation } as never });
      return { kind: "time-blocks", refId: block.id };
    }
    case "delete_task": {
      const taskId = p.taskId as string;
      const existing = await tx.task.findFirst({ where: { id: taskId, userId } });
      if (!existing) throw new Error("Task not found");
      const subtasks = await tx.subtask.findMany({ where: { taskId }, select: { id: true } });
      const subtaskIds = subtasks.map((s) => s.id);
      const conns = await tx.taskBlockConnection.findMany({ where: { OR: [{ taskId }, ...(subtaskIds.length ? [{ subtaskId: { in: subtaskIds } }] : [])] }, select: { timeBlockId: true } });
      const removedBlockIds = [...new Set(conns.map((c) => c.timeBlockId))];
      await tx.task.delete({ where: { id: taskId } });
      await removeXpByEntityPrefix(tx, userId, `task:${taskId}:`);
      for (const sid of subtaskIds) await removeXpByEntityPrefix(tx, userId, `subtask:${sid}:`);
      await reversePropagateForEntities(tx, userId, [{ taskId, subtaskId: null }, ...subtaskIds.map((sid) => ({ taskId: null as string | null, subtaskId: sid }))], tzOffsetMinutes, removedBlockIds);
      return { kind: "tasks", refId: taskId };
    }
    case "create_subtask": {
      const taskId = p.taskId as string;
      const parentId = (p.parentId as string) || null;
      const parsed = parseSubtaskInput({ title: p.title, description: p.description });
      if (!parsed) throw new Error("Invalid subtask");
      const task = await tx.task.findFirst({ where: { id: taskId, userId } });
      if (!task) throw new Error("Task not found");
      if (parentId) {
        const parent = await tx.subtask.findFirst({ where: { id: parentId, taskId } });
        if (!parent) throw new Error("Parent subtask not found");
      }
      const sub = await tx.subtask.create({ data: { taskId, parentId, title: parsed.title, description: parsed.description } as never });
      // se tarefa mãe estava concluída, reabre cadeia
      if (task.done) {
        await tx.task.update({ where: { id: taskId }, data: { done: false } });
        await removeXpForRef(tx, userId, "task.done", xpRefKeys.taskDone(taskId));
      }
      return { kind: "subtasks", refId: sub.id };
    }
    case "update_subtask": {
      const subtaskId = p.subtaskId as string;
      const patch = p.patch as Record<string, unknown>;
      const parsed = parseSubtaskPatch(patch);
      if (!parsed) throw new Error("Invalid subtask patch");
      await tx.subtask.update({ where: { id: subtaskId }, data: parsed as never });
      return { kind: "subtasks", refId: subtaskId };
    }
    case "delete_subtask": {
      const subtaskId = p.subtaskId as string;
      const sub = await tx.subtask.findFirst({ where: { id: subtaskId, task: { userId } }, include: { task: true } });
      if (!sub) throw new Error("Subtask not found");
      const allIds = await tx.subtask.findMany({ where: { taskId: sub.taskId }, select: { id: true, parentId: true } });
      // coleta ids da subárvore
      const toDelete = new Set<string>([subtaskId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const s of allIds) {
          if (s.parentId && toDelete.has(s.parentId) && !toDelete.has(s.id)) {
            toDelete.add(s.id);
            changed = true;
          }
        }
      }
      const ids = [...toDelete];
      const conns = await tx.taskBlockConnection.findMany({ where: { subtaskId: { in: ids } }, select: { timeBlockId: true } });
      const blockIds = [...new Set(conns.map((c) => c.timeBlockId))];
      await tx.subtask.deleteMany({ where: { id: { in: ids } } });
      for (const sid of ids) await removeXpByEntityPrefix(tx, userId, `subtask:${sid}:`);
      await reversePropagateForEntities(tx, userId, ids.map((sid) => ({ taskId: null, subtaskId: sid })), tzOffsetMinutes, blockIds);
      return { kind: "subtasks", refId: subtaskId };
    }
    case "complete_subtask": {
      const subtaskId = p.subtaskId as string;
      const done = p.done !== false;
      const sub = await tx.subtask.findFirst({ where: { id: subtaskId, task: { userId } } });
      if (!sub) throw new Error("Subtask not found");
      if (done === sub.done) return { kind: "subtasks", refId: subtaskId };
      if (done) {
        const { completedSubtaskIds, completedTask } = await markSubtaskDoneCascade(tx, sub.taskId, subtaskId);
        if (completedTask) await awardXpOnce(tx, userId, "task.done", XP_AMOUNTS.taskDone, xpRefKeys.taskDone(sub.taskId));
        for (const sid of completedSubtaskIds) await awardXpOnce(tx, userId, "subtask.done", XP_AMOUNTS.subtaskDone, xpRefKeys.subtaskDone(sid));
        await confirmBlocksForDoneEntities(tx, completedTask ? [sub.taskId] : [], completedSubtaskIds, tzOffsetMinutes);
      } else {
        await reversePropagateForEntities(tx, userId, [{ taskId: null, subtaskId }], tzOffsetMinutes);
        await removeXpForRef(tx, userId, "subtask.done", xpRefKeys.subtaskDone(subtaskId));
      }
      await tx.subtask.update({ where: { id: subtaskId }, data: { done } });
      const stats = await loadGamificationStats(tx, userId, tzOffsetMinutes);
      const newly = await evaluateAchievements(tx, userId, stats);
      await sendGamificationNotifications(userId, { newlyUnlockedAchievements: newly });
      return { kind: "subtasks", refId: subtaskId };
    }
    case "update_habit": {
      const habitId = p.habitId as string;
      const patch = p.patch as Record<string, unknown>;
      const result = parseHabitPatch(patch);
      if (!result.ok) throw new Error(result.error);
      await tx.habit.update({ where: { id: habitId }, data: result.data as never });
      return { kind: "habits", refId: habitId };
    }
    case "delete_habit": {
      const habitId = p.habitId as string;
      const conns = await tx.taskBlockConnection.findMany({ where: { habitId }, select: { timeBlockId: true } });
      const blockIds = [...new Set(conns.map((c) => c.timeBlockId))];
      await tx.habit.delete({ where: { id: habitId } });
      await removeXpByEntityPrefix(tx, userId, `habit:${habitId}:`);
      await reversePropagateForEntities(tx, userId, [], tzOffsetMinutes, blockIds);
      return { kind: "habits", refId: habitId };
    }
    case "undo_habit": {
      const habitId = p.habitId as string;
      const now = new Date();
      const dayStart = startOfDayUtc(now, tzOffsetMinutes);
      await tx.habitCompletion.deleteMany({ where: { habitId, userId, date: dayStart } });
      await removeXpForRef(tx, userId, "habit.confirm", xpRefKeys.habitConfirm(habitId, dayStart.getTime()));
      await removeXpForRef(tx, userId, "habit.slip", xpRefKeys.habitSlip(habitId, dayStart.getTime()));
      return { kind: "habits", refId: habitId };
    }
    case "update_routine": {
      const routineId = p.routineId as string;
      const patch = p.patch as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      if (typeof patch.name === "string") data.name = patch.name.trim();
      if (typeof patch.description === "string") data.description = patch.description.trim() || null;
      if (typeof patch.frequency === "string") data.frequency = patch.frequency === "weekly" ? "weekly" : "daily";
      if (typeof patch.duration === "string") data.duration = patch.duration === "until" ? "until" : "indefinite";
      if (patch.endDate !== undefined) {
        const d = patch.endDate ? new Date(patch.endDate as string) : null;
        data.endDate = d && !isNaN(d.getTime()) ? d : null;
      }
      if (Object.keys(data).length === 0) throw new Error("No changes");
      await tx.routine.update({ where: { id: routineId }, data: data as never });
      return { kind: "routines", refId: routineId };
    }
    case "delete_routine": {
      const routineId = p.routineId as string;
      const blocks = await tx.timeBlock.findMany({ where: { routineId }, select: { id: true } });
      const blockIds = blocks.map((b) => b.id);
      await tx.routine.delete({ where: { id: routineId } });
      await reversePropagateForEntities(tx, userId, [], tzOffsetMinutes, blockIds);
      return { kind: "routines", refId: routineId };
    }
    case "activate_routine": {
      const routineId = p.routineId as string;
      const isActive = !!p.isActive;
      if (isActive) {
        await tx.routine.updateMany({ where: { userId, id: { not: routineId } }, data: { isActive: false } });
        await tx.routine.update({ where: { id: routineId }, data: { isActive: true } });
      } else {
        await tx.routine.update({ where: { id: routineId }, data: { isActive: false } });
      }
      return { kind: "routines", refId: routineId };
    }
    case "update_time_block": {
      const timeBlockId = p.timeBlockId as string;
      const patch = p.patch as Record<string, unknown>;
      const parsed = parseTimeBlockPatch({
        title: patch.title as string | undefined,
        description: patch.description as string | undefined,
        start: patch.start as string | undefined,
        end: patch.end as string | undefined,
        isAllDay: patch.isAllDay as boolean | undefined,
        color: patch.color as string | undefined,
        confirmation: patch.confirmation as string | undefined,
      });
      if (!parsed || Object.keys(parsed).length === 0) throw new Error("Invalid patch");
      const data: Record<string, unknown> = { ...parsed };
      if (parsed.start) data.start = parsed.start;
      if (parsed.end) data.end = parsed.end;
      await tx.timeBlock.update({ where: { id: timeBlockId }, data: data as never });
      return { kind: "time-blocks", refId: timeBlockId };
    }
    case "delete_time_block": {
      const timeBlockId = p.timeBlockId as string;
      await tx.timeBlock.delete({ where: { id: timeBlockId } });
      await reversePropagateForEntities(tx, userId, [], tzOffsetMinutes, [timeBlockId]);
      return { kind: "time-blocks", refId: timeBlockId };
    }
    case "complete_time_block": {
      const timeBlockId = p.timeBlockId as string;
      const value = p.value as string;
      const block = await tx.timeBlock.findFirst({ where: { id: timeBlockId, routine: { userId } }, include: { routine: true } });
      if (!block) throw new Error("Block not found");
      if (block.confirmation === "none") throw new Error("Block has no confirmation");
      const period = periodForFrequency(block.routine.frequency === "weekly" ? "weekly" : "daily", new Date(), tzOffsetMinutes);
      const xpRef = xpRefKeys.block(timeBlockId, period.start.getTime());
      const xpAmount = block.confirmation === "checklist" ? (value === "true" ? 10 : 0) : parseInt(value, 10) || 0;
      if (value === "false") {
        await tx.timeBlockCompletion.deleteMany({ where: { timeBlockId, periodStart: period.start } });
        await reversePropagateForEntities(tx, userId, [], tzOffsetMinutes, [timeBlockId]);
        await import("@/lib/server/connections").then((m) => m.revertAutoHabitCompletionsForBlock(tx, userId, timeBlockId, tzOffsetMinutes));
        const { removeXpForRef: rem } = await import("@/lib/server/gamification/xp");
        await rem(tx, userId, "block.confirm", xpRef);
      } else {
        await tx.timeBlockCompletion.upsert({
          where: { timeBlockId_periodStart: { timeBlockId, periodStart: period.start } },
          create: { timeBlockId, userId, periodStart: period.start, periodEnd: period.end, value, source: "explicit" },
          update: { value, source: "explicit" },
        });
        const { completeEntitiesForBlock } = await import("@/lib/server/connections");
        await completeEntitiesForBlock(tx, userId, timeBlockId, tzOffsetMinutes);
        await awardXpOnce(tx, userId, "block.confirm", xpAmount, xpRef);
      }
      const stats = await loadGamificationStats(tx, userId, tzOffsetMinutes);
      const newly = await evaluateAchievements(tx, userId, stats);
      await sendGamificationNotifications(userId, { newlyUnlockedAchievements: newly });
      return { kind: "time-blocks", refId: timeBlockId };
    }
    case "update_connection": {
      const connectionId = p.connectionId as string;
      const patch = p.patch as Record<string, unknown>;
      const parsed = parseConnectionPatch(patch);
      if (!parsed) throw new Error("Invalid patch");
      await tx.taskBlockConnection.update({ where: { id: connectionId }, data: parsed as never });
      return { kind: "connections", refId: connectionId };
    }
    case "delete_connection": {
      const connectionId = p.connectionId as string;
      const conn = await tx.taskBlockConnection.findFirst({ where: { id: connectionId, userId } });
      if (!conn) throw new Error("Connection not found");
      await tx.taskBlockConnection.delete({ where: { id: connectionId } });
      await reversePropagateForEntities(tx, userId, [{ taskId: conn.taskId, subtaskId: conn.subtaskId }], tzOffsetMinutes, [conn.timeBlockId]);
      if (conn.habitId) {
        const { revertAutoHabitCompletionsForConnections } = await import("@/lib/server/connections");
        await revertAutoHabitCompletionsForConnections(tx, userId, [conn.habitId], tzOffsetMinutes);
      }
      return { kind: "connections", refId: connectionId };
    }
    case "create_connection": {
      const input = parseConnectionInput(p);
      if (!input) throw new Error("Invalid connection");
      const conn = await tx.taskBlockConnection.create({ data: { userId, taskId: input.taskId, subtaskId: input.subtaskId, habitId: input.habitId, timeBlockId: input.timeBlockId, requiredCount: input.requiredCount, dayFilter: input.dayFilter } as never });
      // propagação mínima: não fazemos completeEntitiesForBlock aqui para preview simples, mas aceitamos
      return { kind: "connections", refId: conn.id };
    }
    default:
      throw new Error(`Unsupported kind ${(action as { kind: string }).kind}`);
  }
}

// ---------------------------------------------------------------------------
// Leitura auxiliar para tools read
// ---------------------------------------------------------------------------

export async function executeReadTool(userId: string, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_tasks":
      return prisma.task.findMany({ where: { userId }, select: { id: true, title: true, dueDate: true, priority: true, done: true }, orderBy: { createdAt: "desc" }, take: 20 });
    case "list_habits":
      return prisma.habit.findMany({ where: { userId }, select: { id: true, name: true, type: true, frequency: true, targetCount: true }, take: 20 });
    case "list_routines":
      return prisma.routine.findMany({ where: { userId }, select: { id: true, name: true, frequency: true, isActive: true }, take: 20 });
    case "list_time_blocks": {
      const routineId = typeof args.routineId === "string" ? args.routineId : undefined;
      return prisma.timeBlock.findMany({ where: routineId ? { routineId, routine: { userId } } : { routine: { userId } }, select: { id: true, title: true, start: true, end: true, confirmation: true, routineId: true }, take: 30 });
    }
    default:
      return { error: "unknown read tool" };
  }
}

export function buildProposalActions(
  raws: { kind: ProposalKind; params: Record<string, unknown>; validation: ProposalValidation }[],
): ProposalAction[] {
  return raws.filter(r => r.validation.ok).map(r => ({
    id: randomId(r.kind),
    kind: r.kind,
    params: r.validation.normalizedParams ?? r.params,
    previewTitle: r.validation.previewTitle ?? r.kind,
    previewDescription: r.validation.previewDescription ?? "",
    warnings: r.validation.warnings,
  }));
}
