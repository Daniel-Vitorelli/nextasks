# NexTasks — Frontend

Aplicação Next.js 16 (App Router) com autenticação, painel de rotinas, calendário de blocos de tempo e i18n. O backend de dados é o MySQL/MariaDB (ver `README.md` na raiz).

## Stack

- **Next.js 16** (App Router, Route Handlers)
- **Tailwind CSS 4** + componentes **shadcn/ui** (em `components/ui`)
- **better-auth** (autenticação e sessão)
- **Prisma 7** com cliente gerado (tabelas em `prisma/schema.prisma`)
- **next-intl** (pt-BR e en) — mensagens em `messages/{pt,en}.json`
- **react-hook-form** + **@hookform/resolvers** + **zod** para formulários (mesmo padrão nas páginas de login, no dialog de rotinas e no painel do bloco de tempo)
- **date-fns** — formatação de datas/dias da semana do calendário
- **recharts** + componente **chart** do shadcn/ui (`components/ui/chart.tsx`) — gráfico de progresso da home

## Estrutura

```
app/[locale]                # páginas por localidade (`login`, `sign-up`, `[app]/...`)
app/api/routines            # route handlers das rotinas (GET, POST, PATCH, DELETE)
app/api/routines/progress   # progresso diário (0–100) da rotina ativa (GET)
app/api/routines/current-block # blocos aplicáveis agora + período atual (GET)
app/api/routines/[id]/duplicate # duplica rotina (POST)
app/api/routines/[id]/activate  # ativa/desativa rotina (POST)
app/api/routines/[id]/time-blocks         # blocos de tempo (GET, POST)
app/api/routines/[id]/time-blocks/[blockId] # bloco individual (PATCH, DELETE)
app/api/tasks               # tarefas (GET, POST)
app/api/tasks/[id]          # tarefa individual (PATCH, DELETE)
app/api/tasks/[id]/subtasks # sub-tarefas de uma tarefa (GET, POST)
app/api/subtasks/[id]       # sub-tarefa individual (PATCH, DELETE)
app/api/time-blocks/[id]/complete # confirma bloco no período atual (POST)
app/api/auth                # handler do better-auth
components/dashboard/routines/
  routines-section.tsx      # contêiner: carrega lista, ver mais/ver menos, exclusão
  routine-dialog.tsx        # dialog criar/editar (form com react-hook-form + zod)
  routine-card.tsx          # card de uma rotina (badges, editar/excluir com tooltip)
  routine-calendar-dialog.tsx # calendário de blocos de tempo de uma rotina (WeekView)
components/dashboard/tasks/
  tasks-section.tsx         # contêiner: carrega lista, exclusão
  task-dialog.tsx           # dialog criar/editar (título, descrição, data limite, prioridade)
  task-card.tsx             # card de tarefa (checkbox, prioridade, data limite, ações)
  task-details-dialog.tsx   # dialog "Saiba mais" com detalhes da tarefa + árvore de sub-tarefas
  subtask-tree.tsx          # árvore recursiva de sub-tarefas (expandir/recolher, criar filho, editar, excluir)
  subtask-dialog.tsx        # dialog criar/editar sub-tarefa (título, descrição)
  task-priority.ts          # cores/classes das 6 prioridades
components/app/             # área autenticada (dock, sessão e páginas do app)
  app-dock.tsx              # dock de navegação (Painel, Social, Home, IA, Configurações)
  session-provider.tsx      # provider da sessão + hook useSession
  home/                     # página inicial da área autenticada
    current-block-card.tsx  # card do bloco atual com confirmação (checkbox/nota)
    progress-chart.tsx      # area chart (recharts + ChartContainer do shadcn)
    period-selector.tsx     # seletor 7/15/30/60 dias do gráfico
    tasks-section.tsx       # seção de tarefas: tarefa atual + sub-tarefas + prévia das próximas
components/calendar/        # calendário (semanal): grid, eventos, overlays de drag/resize
  week-view.tsx             # componente principal (semana/dia, scroll horizontal, navegação)
  week-view-grid.tsx        # grid de horas×dias + colunas de eventos
  week-view-all-day-row.tsx # faixa "All-day" + portal da cópia flutuante durante move
  calendar-event-item.tsx   # bloco posicionado no grid (timed)
  all-day-event-item.tsx    # bloco all-day (estados ghost/placeholder/dragging)
  all-day-event-row.tsx     # posiciona um bloco all-day na grade (linhas por conflito)
  day-events-column.tsx     # coluna de um dia: renderiza/bloco redimensionando
  week-view-grid-overlays.tsx # overlays de drag/resize (placeholder, cópia flutuante)
  event-detail-panel.tsx    # popover de edição inline (título, horário, cor, all-day)
  event-detail-popover.tsx  # popover com ancoragem no boundary do calendário
  event-context-menu.tsx    # menu de contexto (cor, excluir)
  calendar-event-color.ts   # classes de cor dos eventos (cores vêm de lib/calendar)
  calendar-event-time.ts    # formatação de hora/duração
  week-view-utils.ts        # constantes de layout + geradores de dias/horas
  week-view-time-axis.tsx   # eixo de horas
  week-view-time-indicator.tsx # linha "agora"
  calendar-day-headers.tsx  # cabeçalho dos dias
  week-view-types.ts        # tipos compartilhados (WeekViewProps, events, etc.)
components/ui               # primitivos shadcn (button, dialog, dropdown-menu, popover, switch, chart, ...)
hooks/                      # hooks do calendário (drag/resize), formulário do bloco e dados (tasks, rotinas, progresso, current-block)
lib/                        # infra (prisma, auth, session, api) + helpers de domínio (time-blocks, task-ordering, completions)
lib/calendar/               # math puro do calendário (posicionamento, all-day, interação drag/resize, fuso, constantes)
lib/validation/             # parsing/validação de payloads da API (routines, tasks, subtasks, time-blocks, helpers)
schemas/                    # schemas zod (login, sign-up, routine, task, time-block)
messages/                   # traduções pt/en
```

## Scripts

```bash
npm run dev     # dev server (http://localhost:3000)
npm run build   # gera build de produção
npm run lint    # eslint
npx tsc --noEmit # typecheck
```

## Banco e schema

Após alterar `prisma/schema.prisma`:

```bash
npx prisma generate   # regenera o client (frontend/generated/prisma)
npx prisma db push    # aplica o schema no banco
```

## Calendário de blocos de tempo

- O componente `WeekView` (em `components/calendar/`) é renderizado pelo `routine-calendar-dialog` e recebe os blocos da rotina via API `time-blocks`.
- Interações: duplo clique cria bloco, arrastar move, bordas redimensionam, movimentos horizontais na faixa all-day, menu de contexto e menu "..." duplicam/excluem.
- Alterações são persistidas via API (`POST`/`PATCH`/`DELETE` em `app/api/routines/[id]/time-blocks{/...}`).
- **Blocos não cruzam a meia-noite**: `createBlockStub` clampa o fim para 23:59:59.999 do mesmo dia quando o fim cairia no dia seguinte; o mapeamento do `routine-calendar-dialog` faz o mesmo clamp para blocos antigos armazenados com fim no dia seguinte (senão o `getEventsForDay` os filtra como multi-dia e somem). A validação zod do popover rejeita fim antes do início no mesmo dia.
- A validação compartilhada dos blocos vive em `lib/time-blocks.ts` (`parseTimeBlockInput`/`parseTimeBlockPatch`) e o schema zod do formulário em `schemas/time-block-schema.ts` (all-day 00:00–00:00 é aceito; a API tolera `end == start` quando `isAllDay`).

## Gráfico de progresso (home)

- Endpoint `GET /api/routines/progress?days=&tzOffset=` retorna o progresso diário (0–100) da rotina ativa do usuário, junto com `confirmableBlockCount` (total de blocos confirmáveis da rotina).
- Cálculo por dia: soma-se o valor dos blocos confirmáveis (checkbox confirmado = 1; nota = `nota/10`) e divide-se pelo total de blocos confirmáveis daquele dia (`confirmation !== "none"`), ×100. Dias sem blocos confirmáveis retornam `value: null` (gap no gráfico). Rotina semanal só conta nos dias da semana dos blocos; o intervalo não passa da data de criação da rotina.
- O gráfico só é renderizado se `confirmableBlockCount > 0`; rotina ativa sem blocos confirmáveis mostra o fallback "Sem dados ainda" (`progressChart.emptyTitle/emptyDescription`) e o seletor de período fica oculto (`showProgressChart` na página).
- O seletor de período é **adaptativo**: o endpoint retorna `daysWithRecords` (dias passados com ao menos um bloco confirmável aplicável, desde a criação da rotina) e o `PeriodSelector` só mostra opções ≤ esse número — com 5 dias de registro nenhuma opção aparece (seletor oculto); com 10, só "7 dias"; com 20, "7 e 15". A seleção atual também é limitada ao maior período disponível (`effectiveDays` na página).
- Sem rotina ativa, a home renderiza um único fallback (`app.home.noActiveRoutine`) no lugar das duas seções.
- Rotina ativa sem blocos confirmáveis **e** sem blocos no momento → fallback único `app.home.emptyRoutine`; quando só um lado está vazio, as seções permanecem separadas. O carregamento inicial usa um único spinner para a área de rotina (`isInitialLoading` na página).
- `useRoutineProgress(days)` carrega os dados com o offset do cliente; ao confirmar um bloco na home (`current-block-card` → `onConfirmed`), a página chama `refetch` e o gráfico atualiza na hora.
- O chart usa o componente `chart.tsx` do shadcn (recharts) com a cor fixa do tema (`--chart-1`).

## Sub-tarefas (árvore)

- Endpoint `GET /api/tasks/:id/subtasks` retorna as sub-tarefas como árvore aninhada (campo `children`), construída em `buildTree` a partir da lista plana ordenada por `createdAt`.
- Criação: `POST /api/tasks/:id/subtasks` com body `{ title, description, parentId? }` — o `parentId` precisa pertencer à mesma tarefa (validação no handler).
- `PATCH /api/subtasks/:id` e `DELETE /api/subtasks/:id` conferem posse via `task.userId`; a exclusão remove toda a sub-árvore (cascade no Prisma).
- A UI (`SubtaskTree` dentro do `task-details-dialog`) renderiza a árvore recursivamente com indentação por profundidade, botão de expandir/recolher e ações por nó (adicionar filho, editar, excluir com confirmação).
- `useSubtasks` mantém o estado da árvore com updates otimistas: `insertNode`/`updateNode`/`removeNode` em `use-subtasks.ts`.
- **Conclusão em cascata** (servidor + otimista): marcar um nó como feito conclui toda a sub-árvore abaixo (`markSubtreeDone`); reabrir um nó reabre a cadeia de ancestrais e a tarefa (`unmarkPath`); concluir o último filho pendente conclui o pai recursivamente (`completeAncestors`); excluir um filho recalcula os ancestrais (filhos restantes todos feitos ou nenhum filho restante ⇒ pai/tarefa concluídos, `removeAndRecomplete`); criar sub-tarefa sob pai concluído reabre a cadeia.

## Tarefas na home

- `TasksSection` (`components/app/home/tasks-section.tsx`) mostra **uma tarefa por vez** entre as pendentes, ordenada por `sortPendingTasks` (`lib/task-ordering.ts`): score = `dueUrgencyScore` (data limite: atrasada 10–15, vence hoje 8–10, ≤3 dias 6–8, ≤7 dias 4–6, ≤30 dias 0–4, sem data 0 — o dia da data limite só conta como atrasado após a meia-noite) + prioridade (1–6); desempate por data mais próxima, prioridade e data de criação.
- O card da tarefa atual replica o `TaskCard` do painel (checkbox, prioridade, data limite) sem ações de edição/exclusão; as sub-tarefas dela aparecem em árvore simplificada com checkbox (mesma regra de cascata) e as próximas (até 5) em linhas sem checkbox.
- Concluir a tarefa atual promove a próxima automaticamente; reabrir sub-tarefas mantém o estado sincronizado com o painel (`useTasks` compartilhado).

## Traduções

As strings ficam em `messages/pt.json` e `messages/en.json`. Novas chaves devem ser adicionadas nos dois arquivos antes de usar `useTranslations` (senão o next-intl falha no typecheck). O namespace do calendário é `dashboard.routines.calendar`, o do gráfico de progresso é `app.home.progressChart`, o das sub-tarefas é `dashboard.tasks.subtasks` e o das tarefas da home é `app.home.tasks`.