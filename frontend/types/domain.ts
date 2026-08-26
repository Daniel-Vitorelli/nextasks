/**
 * Domain types shared across the app (routines, time blocks, completions).
 */

/** How often a routine repeats */
export type Frequency = "daily" | "weekly";

/** How long a routine stays active */
export type Duration = "indefinite" | "until";

/** Predefined colors for time blocks */
export type EventColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "gray";

/** How a time block's completion is confirmed (checklist or score tracking) */
export type EventConfirmation = "none" | "checklist" | "score";

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  duration: Duration;
  endDate: string | null;
  isActive: boolean;
}

export interface RoutineFormValues {
  name: string;
  description: string;
  frequency: Frequency;
  duration: Duration;
  endDate: string;
}

/** Validated routine payload accepted by the API (endDate as a Date) */
export interface RoutinePayload {
  name: string;
  description: string | null;
  frequency: Frequency;
  duration: Duration;
  endDate: Date | null;
}

export interface TimeBlock {
  id: string;
  routineId: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  color: EventColor;
  confirmation: EventConfirmation;
}

/** Raw JSON body accepted by the time-block API endpoints */
export interface TimeBlockInput {
  title?: unknown;
  description?: unknown;
  start?: unknown;
  end?: unknown;
  isAllDay?: unknown;
  color?: unknown;
  confirmation?: unknown;
}

export interface TimeBlockPayload {
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  isAllDay: boolean;
  color: EventColor;
  confirmation: EventConfirmation;
}

export interface TimeBlockPatch {
  title?: string;
  description?: string | null;
  start?: Date;
  end?: Date;
  isAllDay?: boolean;
  color?: EventColor;
  confirmation?: EventConfirmation;
}

export interface ParsedTime {
  hours: number;
  minutes: number;
}

/** A time window (used for completion validity periods) */
export interface Period {
  start: Date;
  end: Date;
}

/** One day of routine progress (value is 0-100 or null when not applicable) */
export interface DailyProgress {
  date: string;
  value: number | null;
  confirmableBlocks: number;
  confirmedValue: number;
}

/** Sequência de dias 100% completos (streak). */
export interface StreakStats {
  /** Dias 100% consecutivos terminando em hoje/ontem (0 se a sequência quebrou). */
  current: number;
  /** Maior sequência de dias 100% já alcançada. */
  longest: number;
  /** Data (ISO, início do dia local) do último dia 100% completo, ou null. */
  lastFullDay: string | null;
}

/** Response of the routine progress endpoint */
export interface ProgressResponse {
  routine: Routine | null;
  /** Quantos blocos confirmaveis (checklist/nota) a rotina ativa tem no total. */
  confirmableBlockCount: number;
  /** Quantos dias no passado têm ao menos um bloco confirmável aplicável. */
  daysWithRecords: number;
  progress: DailyProgress[];
  streak: StreakStats;
  period: Period | null;
}

/** Priority levels of a task (1 = lowest, 6 = highest) */
export const TASK_PRIORITIES = [1, 2, 3, 4, 5, 6] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  done: boolean;
  createdAt: string;
}

/** Task form values (dueDate as yyyy-mm-dd string for the date input) */
export interface TaskFormValues {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
}

/** Validated task payload accepted by the API (dueDate as a Date) */
export interface TaskPayload {
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: TaskPriority;
}

/** Partial task patch (all fields optional) */
export interface TaskPatch {
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: TaskPriority;
  done?: boolean;
}

/** A subtask node of the task tree (parentId null = direct child of the task) */
export interface Subtask {
  id: string;
  title: string;
  description: string | null;
  parentId: string | null;
  done: boolean;
  children: Subtask[];
}

/** Subtask form values */
export interface SubtaskFormValues {
  title: string;
  description: string;
}

/** Validated subtask payload accepted by the API */
export interface SubtaskPayload {
  title: string;
  description: string | null;
}

/** Partial subtask patch (all fields optional) */
export interface SubtaskPatch {
  title?: string;
  description?: string | null;
  done?: boolean;
}

/**
 * Filtro de dia de uma conexão: "all" (qualquer dia), "weekday:N" (dia da
 * semana local, 0-6) ou "date:YYYY-MM-DD" (data específica, local).
 */
export type DayFilter = "all" | `weekday:${number}` | `date:${string}`;

/** Conexão entre uma entidade (tarefa ou sub-tarefa) e um bloco de tempo. */
export interface TaskBlockConnection {
  id: string;
  taskId: string | null;
  subtaskId: string | null;
  habitId: string | null;
  timeBlockId: string;
  requiredCount: number;
  dayFilter: DayFilter;
  /** Quantas confirmações do bloco satisfazem o dayFilter a partir da criação da conexão. */
  confirmedCount: number;
  /** Confirmações que satisfazem o dayFilter mas foram feitas antes da conexão (não contam). */
  countedBefore: number;
}

/** Bloco de tempo listado no catálogo de conexões. */
export interface ConnectionCatalogBlock {
  id: string;
  title: string;
  routineId: string;
  routineName: string;
  frequency: Frequency;
  confirmation: EventConfirmation;
  color: EventColor;
  /** Minutos do início do bloco no fuso do usuário (0-1439). */
  startMinutes: number;
  /** Dia da semana local do início do bloco (0-6). */
  weekday: number;
  /** A rotina do bloco está ativa? (blocos de rotinas inativas não aceitam novas conexões). */
  routineActive: boolean;
}

/** Tarefa listada no catálogo de conexões. */
export interface ConnectionCatalogTask {
  id: string;
  title: string;
  done: boolean;
}

/** Sub-tarefa listada no catálogo de conexões (com a tarefa pai). */
export interface ConnectionCatalogSubtask {
  id: string;
  title: string;
  taskId: string;
  taskTitle: string;
  done: boolean;
}

/** Hábito listado no catálogo de conexões (somente bons conectam). */
export interface ConnectionCatalogHabit {
  id: string;
  name: string;
  type: HabitKind;
  color: EventColor;
  icon: string;
  frequency: HabitFrequency;
}

/** Resposta de GET /api/connections. */
export interface ConnectionsResponse {
  tasks: ConnectionCatalogTask[];
  subtasks: ConnectionCatalogSubtask[];
  habits: ConnectionCatalogHabit[];
  blocks: ConnectionCatalogBlock[];
  connections: TaskBlockConnection[];
}

/** Habit frequency type */
export type HabitFrequency = "daily" | "weekly";

/** Bom = quer construir/manter; ruim = quer largar (lógica invertida). */
export type HabitKind = "good" | "bad";

/** Habit model (as stored in database - daysOfWeek is JSON string) */
export interface Habit {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  color: EventColor;
  type: HabitKind;
  frequency: HabitFrequency;
  daysOfWeek: string; // JSON array of 0-6 (Sunday-Saturday) - only for daily habits
  targetCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Habit with parsed daysOfWeek array */
export interface HabitWithParsedDays extends Omit<Habit, "daysOfWeek"> {
  daysOfWeek: number[];
}

/** Parse daysOfWeek from JSON string to array */
export function parseHabitDaysOfWeek(
  habit: Pick<Habit, "daysOfWeek">,
): number[] {
  try {
    const parsed = JSON.parse(habit.daysOfWeek);
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    }
  } catch {
    return [];
  }
  return [];
}

/**
 * Check if a habit is applicable on a given day based on frequency and
 * daysOfWeek. `today` deve estar deslocado para o fuso do usuário
 * (agora - tzOffset), usando os getters UTC.
 */
export function isHabitApplicableToday(habit: Habit, today: Date = new Date()): boolean {
  return isHabitApplicableOnWeekday(habit, today.getUTCDay());
}

/** Aplicabilidade dado o dia da semana local já calculado (0-6, domingo=0). */
export function isHabitApplicableOnWeekday(
  habit: Pick<Habit, "daysOfWeek"> & { frequency: string; type?: string },
  weekday: number,
): boolean {
  // Ruins são rastreados todos os dias.
  if (habit.type === "bad") return true;
  if (habit.frequency !== "daily") {
    // Weekly habits are applicable every day (weekly deadline)
    return true;
  }
  return parseHabitDaysOfWeek(habit).includes(weekday);
}

/** Habit form values (daysOfWeek as array of numbers for checkboxes) */
export interface HabitFormValues {
  name: string;
  description: string;
  icon: string;
  color: EventColor;
  type: HabitKind;
  frequency: HabitFrequency;
  daysOfWeek: number[]; // Only used for daily habits
  targetCount: number;
}

/** Validated habit payload accepted by the API (daysOfWeek as JSON string) */
export interface HabitPayload {
  name: string;
  description: string;
  icon: string;
  color: EventColor;
  type: HabitKind;
  frequency: HabitFrequency;
  daysOfWeek: string; // JSON array - only for daily habits, empty for weekly
  targetCount: number;
}

/** Partial habit patch (all fields optional, daysOfWeek as JSON string) */
export interface HabitPatch {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: EventColor;
  type?: HabitKind;
  frequency?: HabitFrequency;
  daysOfWeek?: string;
  targetCount?: number;
}

/** Habit completion */
export interface HabitCompletion {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  count: number;
  /** explicit (usuário) | auto (propagado via conexões). */
  source: string;
  createdAt: string;
  updatedAt: string;
}

/** Habit + progresso no período atual (hoje/semana), calculado pela API. */
export type HabitWithProgress = Habit & {
  currentCount: number;
  isApplicableToday: boolean;
};

/** Response of GET /api/habits/stats. */
export interface HabitStats {
  habitId: string;
  /** Um dia por entrada; value 0-100 ou null quando o dia não é agendado. */
  progress: DailyProgress[];
  streak: StreakStats;
}

export interface HabitStatsResponse {
  habits: HabitStats[];
}

/** Resposta de POST/DELETE /api/habits/[id]/complete. */
export interface HabitCompleteResponse {
  completion: HabitCompletion;
  isComplete: boolean;
  periodCount: number;
  type: HabitKind;
}

/** Resposta de DELETE /api/habits/[id]/complete (desfazer marcação do dia). */
export interface HabitUndoResponse {
  ok: boolean;
  removed: boolean;
  periodCount: number;
  type: HabitKind;
}

/** Corpo aceito por POST /api/connections. */
export interface ConnectionInput {
  taskId: string | null;
  subtaskId: string | null;
  habitId: string | null;
  timeBlockId: string;
  requiredCount: number;
  dayFilter: DayFilter;
}

/** Corpo aceito por PATCH /api/connections/[id]. */
export interface ConnectionPatch {
  requiredCount?: number;
  dayFilter?: DayFilter;
}

export interface UserPatch {
  name?: string;
  /** Minutos a oeste de UTC (null = usar o fuso do navegador). */
  timezoneOffset?: number | null;
  /** Avatar como PNG data URL (null = remover a foto). */
  image?: string | null;
}

/** Formato do backup JSON exportado/importado em /app/config. */
export interface DataExport {
  version: number;
  exportedAt: string;
  routines: DataExportRoutine[];
  timeBlocks: DataExportTimeBlock[];
  tasks: DataExportTask[];
  subtasks: DataExportSubtask[];
  connections: DataExportConnection[];
  completions: DataExportCompletion[];
  habits: DataExportHabit[];
  habitCompletions: DataExportHabitCompletion[];
}

export interface DataExportRoutine {
  id: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  duration: Duration;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DataExportTimeBlock {
  id: string;
  routineId: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  color: EventColor;
  confirmation: EventConfirmation;
}

export interface DataExportTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: number;
  done: boolean;
  createdAt: string;
}

export interface DataExportSubtask {
  id: string;
  taskId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  done: boolean;
  createdAt: string;
}

export interface DataExportConnection {
  taskId: string | null;
  subtaskId: string | null;
  habitId: string | null;
  timeBlockId: string;
  requiredCount: number;
  dayFilter: DayFilter;
  createdAt: string;
}

export interface DataExportCompletion {
  timeBlockId: string;
  periodStart: string;
  periodEnd: string;
  value: string;
  source: string;
  sourceEntityId: string | null;
  updatedAt: string;
}

export interface DataExportHabit {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: EventColor;
  type: HabitKind;
  frequency: "daily" | "weekly";
  daysOfWeek: string;
  targetCount: number;
}

export interface DataExportHabitCompletion {
  habitId: string;
  date: string;
  count: number;
}

export interface ImportResult {
  routines: number;
  timeBlocks: number;
  tasks: number;
  subtasks: number;
  connections: number;
  completions: number;
  habits: number;
  habitCompletions: number;
}

/**
 * Ocorrência materializada de um bloco de rotina numa data concreta do
 * calendário (uma rotina diária gera uma ocorrência por dia; uma semanal,
 * uma por semana no dia correspondente).
 */
export interface ScheduledOccurrence {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  color: EventColor;
  confirmation: EventConfirmation;
  routineId: string;
  routineName: string;
  blockId: string;
}

/* ------------------------------------------------------------------ */
/* Gamificação                                                          */
/* ------------------------------------------------------------------ */

/** Tipos de evento de XP (kind do XpEvent). */
export type XpKind =
  | "block.confirm"
  | "task.done"
  | "subtask.done"
  | "habit.confirm"
  | "habit.target"
  | "habit.slip"
  | "routine.dayFull";

/** Evento do ledger de XP (serializado). */
export interface XpEventRow {
  id: string;
  kind: string;
  refKey: string | null;
  amount: number;
  createdAt: string;
}

/** Tier de uma conquista. */
export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

/**
 * Definição serializável de conquista. Cada condição é um par
 * estatística/alvo — todas devem ser satisfeitas para desbloquear.
 */
export interface AchievementDef {
  id: string;
  tier: AchievementTier;
  icon: string; // nome Lucide
  xpReward: number;
  conditions: { stat: string; target: number }[];
}

/** Conquista com estado de desbloqueio + progresso atual. */
export interface AchievementView extends AchievementDef {
  nameKey: string;
  descriptionKey: string;
  unlockedAt: string | null;
  /** Progresso 0-100 = min sobre as condições. */
  progress: number;
}

/** Rank derivado da faixa de nível. */
export interface RankDef {
  id: string;
  nameKey: string; // app.gamification.ranks.<id>
  minLevel: number;
  color: EventColor;
  /** Nome Lucide do ícone do rank. */
  icon: string;
}

/** Resumo completo de GET /api/gamification. */
export interface GamificationSummary {
  totalXp: number;
  level: number;
  levelProgress: number; // 0-100 dentro do nível atual
  xpToNextLevel: number;
  rank: RankDef;
  nextRank: RankDef | null;
  achievements: AchievementView[];
  unlockedCount: number;
  recentEvents: XpEventRow[];
  breakdown: { kind: string; amount: number }[];
  /** Melhor sequência de dias/semanas 100% da rotina ativa. */
  bestRoutineStreak: number;
  /** Sequência 100% atual da rotina ativa. */
  currentRoutineStreak: number;
  /** Melhor sequência limpa entre hábitos ruins. */
  bestCleanStreak: number;
  /** Sequência limpa atual (máx. entre hábitos ruins). */
  currentCleanStreak: number;
}

/* ------------------------------- Amizades -------------------------------- */

/** Perfil público de um usuário (o que amigos podem ver na lista). */
export interface FriendProfile {
  id: string;
  name: string;
  image: string | null;
  totalXp: number;
  level: number;
  rank: RankDef;
}

/** Pedido recebido/enviado pendente. */
export interface FriendRequestView {
  id: string; // id da Friendship
  createdAt: string;
  user: FriendProfile;
}

/** Resposta de GET /api/friends. */
export interface FriendsResponse {
  friends: FriendProfile[];
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
}

/** Estatísticas públicas do detalhe do amigo. */
export interface FriendDetail {
  profile: FriendProfile;
  blocksConfirmed: number;
  tasksDone: number;
  days100: number;
  bestRoutineStreak: number;
  currentRoutineStreak: number;
  bestCleanStreak: number;
  unlockedCount: number;
}

/* --------------------------- Social: extras ------------------------------ */

/** Linha do ranking semanal de XP (usuário + amigos). */
export interface LeaderboardEntry {
  userId: string;
  name: string;
  image: string | null;
  /** XP ganho dentro da semana corrente do solicitante. */
  weekXp: number;
  level: number;
  rank: RankDef;
  isMe: boolean;
}

export interface UserSearchResult {
  id: string;
  name: string;
  image: string | null;
  level: number;
  rank: RankDef;
  /** Estado do relacionamento: nada pendente / meu pedido aguardando / pedido recebido. */
  relationStatus: "none" | "outgoing" | "incoming";
}

/** Item do feed de atividade social. */
export interface ActivityFeedItem {
  id: string;
  actorId: string;
  actorName: string;
  actorImage: string | null;
  kind: "achievement.unlock" | "level.up" | "friend.accepted";
  data: Record<string, string | number>;
  createdAt: string;
}
