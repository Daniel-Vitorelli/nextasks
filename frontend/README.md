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

## Estrutura

```
app/[locale]                # páginas por localidade (`login`, `sign-up`, `[app]/...`)
app/api/routines            # route handlers das rotinas (GET, POST, PATCH, DELETE)
app/api/routines/[id]/time-blocks         # blocos de tempo (GET, POST)
app/api/routines/[id]/time-blocks/[blockId] # bloco individual (PATCH, DELETE)
app/api/auth                # handler do better-auth
components/dashboard/routines/
  routines-section.tsx      # contêiner: carrega lista, ver mais/ver menos, exclusão
  routine-dialog.tsx        # dialog criar/editar (form com react-hook-form + zod)
  routine-card.tsx          # card de uma rotina (badges, editar/excluir com tooltip)
  routine-calendar-dialog.tsx # calendário de blocos de tempo de uma rotina (WeekView)
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
  use-event-detail-form.ts  # hook do form do painel (commit no blur, Enter/ESC)
  event-detail-popover.tsx  # popover com ancoragem no boundary do calendário
  event-context-menu.tsx    # menu de contexto (cor, excluir)
  calendar-event-color.ts   # cores dos eventos (EVENT_COLORS, classes)
  calendar-event-time.ts    # formatação de hora/duração
  week-view-utils.ts        # constantes de layout + geradores de dias/horas
  week-view-time-axis.tsx   # eixo de horas
  week-view-time-indicator.tsx # linha "agora"
  calendar-day-headers.tsx  # cabeçalho dos dias
  week-view-types.ts        # tipos compartilhados (WeekViewProps, events, etc.)
components/ui               # primitivos shadcn (button, dialog, dropdown-menu, popover, switch, ...)
hooks/                      # use-event-drag, use-event-resize, use-all-day-resize, ...
lib/                        # prisma, auth, session, event-utils, time-blocks
schemas/                    # schemas zod (login, sign-up, routine, time-block)
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
- A validação compartilhada dos blocos vive em `lib/time-blocks.ts` (`parseTimeBlockInput`/`parseTimeBlockPatch`) e o schema zod do formulário em `schemas/time-block-schema.ts`.

## Traduções

As strings ficam em `messages/pt.json` e `messages/en.json`. Novas chaves devem ser adicionadas nos dois arquivos antes de usar `useTranslations` (senão o next-intl falha no typecheck). O namespace do calendário é `dashboard.routines.calendar`.