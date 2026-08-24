import { randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import type {
  EventConfirmation,
  Frequency,
} from "@/types/domain";

/**
 * Acessível do host via 127.0.0.1 (a porta 3306 é publicada pelo compose).
 * O hostname "mysql" só resolve dentro da rede do Docker, então os testes
 * (rodados na máquina host) usam localhost.
 */
export const TEST_DATABASE_URL =
  "mysql://app_user:app123@127.0.0.1:3306/app_test";

let client: PrismaClient | null = null;

/** Cliente Prisma dedicado ao banco de testes (app_test no MySQL local). */
export function testPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      adapter: new PrismaMariaDb(TEST_DATABASE_URL),
    });
  }
  return client;
}

const TABLES = [
  "TimeBlockCompletion",
  "TaskBlockConnection",
  "TimeBlock",
  "Subtask",
  "Task",
  "Routine",
  "Account",
  "Session",
  "Verification",
  "User",
] as const;

/** Limpa todas as tabelas entre testes (FK checks desligados para TRUNCATE). */
export async function resetDb(): Promise<void> {
  const prisma = testPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
    for (const table of TABLES) {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
    }
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
  });
}

let userCounter = 0;

/** Cria um usuário com e-mail único para o teste. */
export async function createUser(overrides: { name?: string } = {}) {
  userCounter += 1;
  return testPrisma().user.create({
    data: {
      name: overrides.name ?? `Test User ${userCounter}`,
      email: `user-${userCounter}-${randomUUID()}@test.local`,
    },
  });
}

/** Cria uma rotina (ativa por padrão). */
export async function createRoutine(
  userId: string,
  overrides: {
    name?: string;
    frequency?: Frequency;
    isActive?: boolean;
  } = {},
) {
  return testPrisma().routine.create({
    data: {
      userId,
      name: overrides.name ?? "Test Routine",
      frequency: overrides.frequency ?? "daily",
      isActive: overrides.isActive ?? true,
    },
  });
}

/**
 * Cria um bloco de tempo. `startOffsetMs`/`endOffsetMs` são relativos a `now`
 * para os testes controlarem "bloco já começou" e "bloco no futuro".
 */
export async function createBlock(
  routineId: string,
  overrides: {
    title?: string;
    start?: Date;
    end?: Date;
    confirmation?: EventConfirmation;
    isAllDay?: boolean;
  } = {},
) {
  const start =
    overrides.start ??
    new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h atrás: já começou
  const end =
    overrides.end ?? new Date(start.getTime() + 60 * 60 * 1000);
  return testPrisma().timeBlock.create({
    data: {
      routineId,
      title: overrides.title ?? "Test Block",
      start,
      end,
      isAllDay: overrides.isAllDay ?? false,
      confirmation: overrides.confirmation ?? "checklist",
    },
  });
}

/** Cria uma tarefa (não concluída por padrão). */
export async function createTask(
  userId: string,
  overrides: { title?: string; done?: boolean } = {},
) {
  return testPrisma().task.create({
    data: {
      userId,
      title: overrides.title ?? "Test Task",
      done: overrides.done ?? false,
    },
  });
}

/** Cria uma sub-tarefa (raiz ou filha, conforme parentId). */
export async function createSubtask(
  taskId: string,
  overrides: {
    title?: string;
    parentId?: string | null;
    done?: boolean;
  } = {},
) {
  return testPrisma().subtask.create({
    data: {
      taskId,
      title: overrides.title ?? "Test Subtask",
      parentId: overrides.parentId ?? null,
      done: overrides.done ?? false,
    },
  });
}

/** Cria uma conexão entre entidade e bloco. */
export async function createConnection(
  userId: string,
  timeBlockId: string,
  entity: { taskId?: string | null; subtaskId?: string | null },
  overrides: {
    requiredCount?: number;
    dayFilter?: string;
    createdAt?: Date;
  } = {},
) {
  return testPrisma().taskBlockConnection.create({
    data: {
      userId,
      timeBlockId,
      taskId: entity.taskId ?? null,
      subtaskId: entity.subtaskId ?? null,
      requiredCount: overrides.requiredCount ?? 1,
      dayFilter: overrides.dayFilter ?? "all",
      createdAt: overrides.createdAt,
    },
  });
}

/** Cria uma confirmação explícita de um bloco num período (para histórico). */
export async function createCompletion(
  userId: string,
  timeBlockId: string,
  periodStart: Date,
  value: string,
  overrides: {
    source?: string;
    sourceEntityId?: string | null;
    updatedAt?: Date;
  } = {},
) {
  return testPrisma().timeBlockCompletion.create({
    data: {
      userId,
      timeBlockId,
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 86_400_000),
      value,
      source: overrides.source ?? "explicit",
      sourceEntityId: overrides.sourceEntityId ?? null,
      updatedAt: overrides.updatedAt,
    },
  });
}

/** Cria um hábito para o usuário. */
export async function createHabit(
  userId: string,
  overrides: {
    name?: string;
    color?: string;
    type?: "good" | "bad";
    frequency?: "daily" | "weekly";
    daysOfWeek?: string;
    targetCount?: number;
  } = {},
) {
  return testPrisma().habit.create({
    data: {
      userId,
      name: overrides.name ?? "Beber água",
      icon: "CheckCircle2",
      color: overrides.color ?? "green",
      type: overrides.type ?? "good",
      frequency: overrides.frequency ?? "daily",
      daysOfWeek: overrides.daysOfWeek ?? JSON.stringify([1, 3, 5]),
      targetCount: overrides.targetCount ?? 1,
    },
  });
}

/** Cria uma conclusão de hábito num dia (chave: meia-noite UTC do dia local). */
export async function createHabitCompletion(
  userId: string,
  habitId: string,
  date: Date,
  count = 1,
) {
  return testPrisma().habitCompletion.create({
    data: { userId, habitId, date, count },
  });
}