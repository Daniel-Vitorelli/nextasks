# NextAsks — Agent Instructions

## Project Overview

**NextAsks** is a fullstack task/routine management application built with:
- **Frontend/API**: Next.js 16 (App Router, Route Handlers) + TypeScript
- **Database**: MySQL 8.4 via Prisma ORM (client output: `frontend/generated/prisma`)
- **Auth**: better-auth (email/password, session cookies)
- **UI**: Tailwind CSS 4 + shadcn/ui components (`components/ui/`)
- **i18n**: next-intl (Portuguese + English, messages in `messages/{pt,en}.json`)
- **Forms**: react-hook-form + zod validation (shared schemas in `schemas/`, parsers in `lib/validation/`)
- **Charts**: recharts + shadcn `chart.tsx`
- **Tests**: Vitest (`npm run test`)

Docker Compose orchestrates three services: `mysql`, `next_app` (frontend+API), `phpmyadmin`.

---

## Key Directories

```
frontend/
├── app/
│   ├── [locale]/                    # i18n routes
│   │   ├── [app]/                   # authenticated area (dashboard, home, social, ai, config)
│   │   ├── login/page.tsx
│   │   └── sign-up/page.tsx
│   └── api/                         # Route Handlers (all require auth)
│       ├── routines/                # CRUD + progress, current-block, activate, duplicate
│       ├── routines/[id]/time-blocks/  # time blocks CRUD
│       ├── tasks/                   # tasks CRUD
│       ├── tasks/[id]/subtasks/     # subtask tree + create
│       ├── subtasks/[id]/           # subtask PATCH/DELETE (cascades)
│       ├── time-blocks/[id]/complete # confirm block (propagates to connections)
│       ├── connections/             # connection catalog + CRUD
│       ├── habits/                  # habits CRUD + complete + stats
│       ├── auth/[...all]/           # better-auth handler
│       └── data/import|export/      # backup/restore (inclui hábitos)
├── components/
│   ├── dashboard/routines/          # routine cards, dialogs, calendar dialog
│   ├── dashboard/tasks/             # task cards, dialogs, subtask tree
│   ├── dashboard/habits/            # habits section (CRUD), card, dialog (ícone/cor)
│   ├── app/                         # authenticated layout (dock, session, home sections)
│   │   └── home/habits-check-in.tsx # confirmação diária + streak/heatmap por hábito
│   ├── calendar/                    # WeekView + drag/resize overlays
│   ├── connections/                 # connection popover, provider, badges
│   └── ui/                          # shadcn primitives
├── hooks/                           # data hooks (tasks, routines, subtasks, blocks, progress, habits)
├── lib/
│   ├── server/                      # server-only: prisma, auth, session, api helpers, connections, subtask-cascade, completions, data-transfer
│   ├── validation/                  # zod parsers for API payloads (shared client/server)
│   ├── calendar/                    # pure calendar math (positioning, drag, timezone) + event constants/colors
│   ├── task-ordering.ts             # urgency scoring for home task selection
│   ├── subtask-tree.ts              # pure tree mutations (insert/update/remove/cascade)
│   ├── time-blocks.ts               # block helpers
│   ├── habit-stats.ts               # pure per-habit daily progress (agenda/semana)
│   ├── streak.ts                    # computeStreak (dias 100% consecutivos)
│   ├── lucide-icons.ts              # catálogo curado de ícones para hábitos
│   └── utils.ts                     # cn(), date helpers
├── schemas/                         # zod schemas for forms (login, signup, routine, task, time-block, habit)
├── types/                           # domain types, calendar types
├── messages/                        # i18n translations (pt.json, en.json)
├── prisma/schema.prisma             # database schema
└── tests/                           # vitest unit/integration tests
```

---

## Development Commands

```bash
# From project root
docker compose up -d --build   # start all services (rebuild on code changes)
docker compose logs -f next_app # follow frontend logs
docker compose exec next_app sh # shell in frontend container

# Inside frontend/ (local dev, requires MySQL running)
npm run dev       # dev server at localhost:3000
npm run build     # production build
npm run lint      # eslint
npx tsc --noEmit  # typecheck
npm run test      # vitest run
npm run test:watch
npm run test:coverage

# Prisma (after schema changes)
npx prisma generate
npx prisma db push
```

---

## Database Schema (Prisma)

Key models (see `frontend/prisma/schema.prisma`):
- `User` — better-auth fields + `timezoneOffset`, relations to routines/tasks/connections/completions
- `Routine` — name, description, frequency (daily/weekly), duration (indefinite/until), `isActive` (only one per user), timeBlocks
- `TimeBlock` — title, start/end, isAllDay, color, **confirmation** (none/checklist/score), routine relation, completions, connections
- `TimeBlockCompletion` — periodStart/periodEnd, value ("true"/"false" or "1"–"10"), **source** (explicit/auto), **sourceEntityId** ("task:<id>" | "subtask:<id>")
- `Task` — title, description, dueDate, priority (1–6), done, subtasks, connections
- `Subtask` — recursive tree (parentId/children), taskId, done, connections
- `TaskBlockConnection` — M:N task/subtask ↔ timeBlock, `requiredCount`, `dayFilter` ("all" | "weekday:N" | "date:YYYY-MM-DD"), unique constraints on (taskId,timeBlockId) and (subtaskId,timeBlockId)
- `Habit` — name, description, icon (nome Lucide), color (EventColor), frequency (daily/weekly), `daysOfWeek` (JSON array 0–6, só diário), targetCount
- `HabitCompletion` — date (meia-noite UTC do dia local do usuário), count, unique (habitId,date)

---

## Critical Business Logic

### Subtask Completion Cascade (`lib/server/subtask-cascade.ts`, `lib/subtask-tree.ts`)
- Mark done → completes entire subtree below (`markSubtreeDone`)
- Unmark → reopens ancestor chain + task (`unmarkPath`)
- Complete last pending child → completes parent recursively (`completeAncestors`)
- Delete child → recalculates ancestors (`removeAndRecomplete`)
- Create subtask under completed parent → reopens chain

### Task/Subtask ↔ TimeBlock Connections (`lib/server/connections.ts`)
- **Block confirmed** → completes entity when **all** its connections satisfied
- **Entity completed** → auto-confirms connected blocks in current period (checklist "true", score "10")
- **Reverse propagation**: unconfirm block → removes auto-confirmations, reopens entities that only had that block; unmark entity → removes its auto-confirmations, re-evaluates connected blocks
- `dayFilter` semantics: daily = that day; weekly = weekday of block within period week (`applicableDayUtc`)
- Impossible filters rejected (weekly block with different weekday/date filter) — 400 on create/update
- Connections to blocks with `confirmation: "none"` rejected
- Auto-confirm is **create-if-missing** (never overwrites explicit user decision)
- Propagation only for entities that **actually transitioned** (pending → done)

### Home Task Selection (`lib/task-ordering.ts`)
- One pending task at a time, ordered by: `dueUrgencyScore` (overdue 10–15, today 8–10, ≤3d 6–8, ≤7d 4–6, ≤30d 0–4, none 0) + priority (1–6)
- Tiebreak: earlier dueDate → higher priority → earlier createdAt

### Progress Chart (`app/api/routines/progress/route.ts`)
- Daily % = confirmedValue / confirmableBlocks × 100
- Checkbox = 1, score = score/10 (only 10 = 1)
- Weekly routines only count on block's weekday
- `daysWithRecords` returned for adaptive period selector (only show options ≤ recorded days)

### Habits (`app/api/habits/**`, `lib/habit-stats.ts`, `lib/streak.ts`)
- **Dashboard = só CRUD**; confirmação fica na home (`HabitsCheckIn`), que lista hábitos aplicáveis hoje
- Aplicabilidade: diário → `daysOfWeek` inclui o dia local; semanal → todos os dias (meta vale a semana)
- `POST /:id/complete`: upsert em `HabitCompletion` (chave = meia-noite UTC do dia local via tzOffset); diário fora da agenda → 400; contagem satura em `targetCount`; responde `{ completion, isComplete, periodCount }` (diário = hoje, semanal = soma da semana corrente)
- `GET /api/habits?tzOffset=` devolve cada hábito com `currentCount` e `isApplicableToday` (mesma convenção de dia do complete)
- `GET /api/habits/stats?days=&tzOffset=`: progresso diário 0–100 por hábito + streak (`computeStreak`); dias não agendados ficam `null` e não quebram streak; semanal mostra preenchimento da semana corrente (100% nos dias de semana completa)
- Cores usam os tokens `--event-*` (ver `Heatmap color=` e `StreakCard accentColor`); ícones vêm do catálogo curado `lib/lucide-icons.ts`
- Backup/export inclui hábitos + conclusões (parser aceita backups antigos sem eles)

---

## API Routes Summary

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/routines` | List user routines |
| POST | `/api/routines` | Create routine |
| PATCH | `/api/routines/:id` | Update routine |
| DELETE | `/api/routines/:id` | Delete routine |
| GET | `/api/routines/:id/time-blocks` | List routine's time blocks |
| POST | `/api/routines/:id/time-blocks` | Create time block |
| PATCH | `/api/routines/:id/time-blocks/:blockId` | Update time block |
| DELETE | `/api/routines/:id/time-blocks/:blockId` | Delete time block |
| GET | `/api/routines/progress` | Daily progress (query: days, tzOffset) |
| GET | `/api/routines/current-block` | Current applicable blocks |
| POST | `/api/routines/:id/duplicate` | Duplicate routine + blocks |
| POST | `/api/routines/:id/activate` | Toggle active (one per user) |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task (incl. done) |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/tasks/:id/subtasks` | Nested subtask tree |
| POST | `/api/tasks/:id/subtasks` | Create subtask (optional parentId) |
| PATCH | `/api/subtasks/:id` | Update subtask |
| DELETE | `/api/subtasks/:id` | Delete subtask + subtree |
| POST | `/api/time-blocks/:id/complete` | Confirm block (body: value, query: tzOffset) |
| GET | `/api/connections` | Catalog (tasks, subtasks, blocks + connections with confirmedCount) |
| POST | `/api/connections` | Create connection |
| PATCH | `/api/connections/:id` | Update requiredCount/dayFilter |
| DELETE | `/api/connections/:id` | Remove connection (propagates if last unsatisfied) |
| GET | `/api/habits?tzOffset=` | List habits + `currentCount`/`isApplicableToday` do período |
| POST | `/api/habits` | Create habit |
| GET/PATCH/DELETE | `/api/habits/:id` | Habit detail/update/delete |
| POST | `/api/habits/:id/complete` | Confirm habit (query: tzOffset; body: increment) |
| GET | `/api/habits/stats?days=&tzOffset=` | Progresso diário + streak por hábito |

All routes require authentication (session cookie from better-auth).

---

## Validation Patterns

- **Shared parsers** in `lib/validation/` used by both frontend forms and API handlers
- `parseRoutineInput` / `parseRoutinePatch` → routines
- `parseTaskInput` / `parseTaskPatch` → tasks
- `parseSubtaskInput` / `parseSubtaskPatch` → subtasks
- `parseTimeBlockInput` / `parseTimeBlockPatch` → time blocks
- `parseConnectionInput` / `parseConnectionPatch` / `parseDayFilter` → connections
- `parseHabitInput` / `parseHabitPatch` → habits (diário exige ≥1 dia; semanal descarta os dias)
- Zod schemas in `schemas/` for react-hook-form (login, signup, routine, task, time-block, habit)

---

## UI/Component Patterns

- **shadcn/ui primitives** in `components/ui/` (button, dialog, popover, dropdown-menu, chart, etc.)
- **Form pattern**: react-hook-form + zod resolver → `useForm` + `FormProvider` → `FormField` + `FormItem` + `FormControl` + `FormMessage`
- **Dialogs**: `Dialog` + `DialogTrigger` + `DialogContent` + form inside
- **Popovers**: `Popover` + `PopoverTrigger` + `PopoverContent` (use `onInteractOutside` with `[data-radix-popper-content-wrapper]` check when nested in dialogs)
- **Tooltips**: `TooltipProvider` + `Tooltip` + `TooltipTrigger` + `TooltipContent`
- **Charts**: `ChartContainer` + `ChartWrapper` + `ResponsiveContainer` + `AreaChart` (see `progress-chart.tsx`)

---

## Data Synchronization (Client)

- `ConnectionsProvider` (`components/connections/connections-provider.tsx`) — global connection state + optimistic updates
- `useDataSync` (`lib/client/data-events.ts`) — typed event bus for cross-screen updates
  - Channels: `tasks`, `subtasks`, `connections`, `routines`, `time-blocks`, `progress`, `current-block`, `habits`
  - Mutations call `notifyDataChanged([channels])`
  - Hooks register `refetch` callbacks per channel

---

## i18n

- Namespaces: `auth`, `dashboard.routines`, `dashboard.routines.calendar`, `dashboard.tasks`, `dashboard.tasks.subtasks`, `dashboard.habits`, `app.home`, `app.home.progressChart`, `app.home.tasks`, `app.home.habits`
- Add keys to **both** `messages/pt.json` and `messages/en.json` before using `useTranslations`
- Day names via date-fns locale (`pt-BR` / `en-US`)

---

## Testing

```bash
npm run test           # run all tests
npm run test:watch     # watch mode
npm run test:coverage  # with coverage
```

Test files in `tests/`:
- `validation.test.ts` — zod parser tests
- `task-ordering.test.ts` — urgency scoring
- `subtask-tree.test.ts` / `subtask-cascade.test.ts` — tree mutations
- `time-blocks.test.ts` — block helpers
- `connections.test.ts` / `connection-utils.test.ts` — connection logic
- `schedule.test.ts` — calendar scheduling
- `streak.test.ts` — streak calculation
- `completions.test.ts` — completion logic
- `habit-stats.test.ts` — progresso diário por hábito (agenda/semana)
- `user-io.test.ts` — user input helpers + export/import round-trip

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Port 3000/8080 in use | `docker ps` → stop conflicting process |
| Frontend container restart loop | `docker compose logs next_app` — usually DB connection (wait for mysql healthcheck) or Prisma schema error |
| Code changes not reflected | Use `docker compose up -d --build` (Dockerfile copies source at build) |
| Prisma schema changes not applied | `docker compose exec next_app npx prisma db push && npx prisma generate` |
| Typecheck fails on new i18n key | Add key to both `pt.json` and `en.json` |

---

## Environment Variables (frontend/.env)

```
DATABASE_URL=mysql://app_user:app123@mysql:3306/app
BETTER_AUTH_SECRET=<secret>
BETTER_AUTH_URL=http://localhost:3000
```

---

## Docker Services

| Service | Container | Port | Notes |
|---------|-----------|------|-------|
| MySQL | `mysql` | 3306 (internal) | Volume `mysql_data` persists data |
| Next.js | `next_app` | 3000 | Builds `./frontend`, runs `prisma db push` on start |
| phpMyAdmin | `phpmyadmin` | 8080 | Host: `mysql`, User: `app_user`, Pass: `app123` |

---

## Agent Workflow Notes

- **Always** run `npm run lint` and `npx tsc --noEmit` after changes
- **Prefer** editing existing files over creating new ones
- **Follow** existing patterns: validation in `lib/validation/`, server logic in `lib/server/`, pure helpers in `lib/`
- **Shared types** in `types/domain.ts` and `types/calendar.ts`
- **Server-only imports** from `lib/server/` — never import in client components
- **Client components** use `'use client'` directive; server components are default
- **Translations**: add to both locale files before using