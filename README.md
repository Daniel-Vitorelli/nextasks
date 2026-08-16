# NextAsks

Aplicação fullstack com **Next.js 16** (frontend + API), **MariaDB/MySQL** como banco de dados e **phpMyAdmin** para gerenciamento visual do banco. Todo o ambiente roda via **Docker Compose**.

## Arquitetura

| Serviço       | Container        | Porta | Imagem / Build                       |
|---------------|------------------|-------|--------------------------------------|
| Frontend/API  | `next_app`       | 3000  | build `./frontend` (Dockerfile)      |
| MySQL         | `mysql`          | (int) | `mysql:8.4`                          |
| phpMyAdmin    | `phpmyadmin`     | 8080  | `phpmyadmin:latest`                  |

- Banco de dados: `app`
- Usuário do banco: `app_user` / `app123`
- Senha do root do banco: `root123`
- Vehicle/app: rede interna `app_network`, volume persistente `mysql_data`

> **Aviso:** os dados de banco ficam em um volume (`mysql_data`). Eles sobrevivem a `docker compose down` e só são apagados com `docker compose down -v`. Credenciais de banco no `docker-compose.yaml` são de desenvolvimento.

## Funcionalidades

- **Autenticação** — e-mail e senha com `better-auth`, nas páginas `/sign-up` e `/login`.
- **Área autenticada** (`/[locale]/app/*`) — nav em dock (Painel, Social, Home, IA, Configurações) e proteção de rota via sessão.
- **Painel de rotinas** (`/app/dashboard`):
  - Criação, edição e exclusão de rotinas (exclusão com dialog de confirmação).
  - Campos: nome, descrição, frequência (diária/semanal) e duração (indeterminada ou com data final).
  - Formulário validado com **Zod + React Hook Form** (erros por campo), no mesmo padrão das páginas de login.
  - Listagem limitada a 4 itens com "ver todas / ver menos".
- **Painel de tarefas** (`/app/dashboard`):
  - Criação, edição e exclusão de tarefas (exclusão com dialog de confirmação).
  - Campos: título (obrigatório), descrição e data limite (opcionais) e 6 prioridades (muito baixa → urgente).
  - Checkbox por tarefa para alternar conclusão (concluídas vão para o fim da lista) e botão "Saiba mais" com dialog de detalhes.
  - **Sub-tarefas**: árvore recursiva sem limite de profundidade dentro do dialog "Saiba mais" — cada sub-tarefa tem título (obrigatório) e descrição (opcional), pode ter filhos, e é excluída com confirmação (remove toda a sub-árvore).
  - **Conclusão consistente**: marcar uma tarefa/sub-tarefa como feita conclui toda a sub-árvore abaixo dela; reabrir uma sub-tarefa reabre a cadeia de ancestrais e a tarefa; concluir o último filho pendente (ou excluir o único filho pendente) conclui o pai automaticamente, subindo a cadeia até a tarefa; criar sub-tarefa sob um pai/tarefa concluídos reabre a cadeia.
  - **Conexões com blocos de tempo** (M:N): qualquer tarefa ou sub-tarefa pode ser conectada a um ou mais blocos de tempo (popover no dialog de detalhes, no botão por sub-tarefa da árvore e no popover do bloco no calendário). Concluir um lado conclui o outro: bloco confirmado completa a entidade quando **todas** as conexões dela estiverem satisfeitas; entidade concluída auto-confirma os blocos conectados no período atual. Cada conexão tem `requiredCount` (confirmações necessárias, contando o histórico) e `dayFilter` (todos os dias / dia da semana / data específica); desmarcar não propaga. Detalhes da lógica: o `dayFilter` avalia o **dia aplicável** (diária = o dia; semanal = o dia da semana em que o bloco ocorre dentro da semana do período) e filtros impossíveis para o bloco (weekday/data de outro dia da semana em blocos semanais) são rejeitados com 400 e nem aparecem na UI; conexões com blocos sem modo de confirmação (`confirmation: "none"`) são recusadas; a auto-confirmação é create-if-missing (nunca sobrescreve a decisão explícita do usuário) e só acontece para entidades que de fato transicionaram (sem inflação de contagens); a unicidade é garantida no banco (`@@unique` de tarefa/bloco e sub-tarefa/bloco) com P2002 → 400.
- **Calendário de blocos de tempo** (`/app/dashboard`, clicando no ícone de calendário de uma rotina):
  - Visão semanal com blocos de tempo (eventos) por dia e por hora, navegação entre semanas e scroll horizontal.
  - Duplo clique numa célula cria um bloco; blocos podem ser **arrastados** (mover), **redimensionados** (dobrar borda) e **movidos entre dias** (all-day).
  - Blocos **nunca cruzam a meia-noite**: se a criação cairia no dia seguinte, o fim vai ao último horário disponível do dia (23:59:59).
  - Popover de edição inline (título, horário, cor, modo dia inteiro), menu de contexto (cor/excluir) e menu "..." por bloco (duplicar/excluir).
  - Formulário dos blocos validado com **Zod + react-hook-form**, commit no blur (Enter/ESC), com mensagens traduzidas em pt/en.
- **Home** (`/app/home`):
  - **Blocos atuais**: lista os blocos de tempo da rotina ativa aplicáveis agora, com confirmação por checkbox ou nota (1–10).
  - **Gráfico de progresso**: area chart (recharts + componente `chart.tsx` do shadcn/ui) com o progresso diário da rotina ativa, com seletor de período (7/15/30/60 dias). O seletor é **adaptativo**: só aparecem opções até o número de dias registrados (`daysWithRecords` — dias passados com ao menos um bloco confirmável); sem registro suficiente ele fica oculto.
  - O valor diário é a % de blocos confirmáveis: checkbox confirmado vale 1; nota vale `nota/10` (só nota 10 equivale a um checkbox). Dia perfeito = 100%. Dias sem blocos confirmáveis ficam como gaps no gráfico.
  - O gráfico só é exibido se a rotina ativa tiver blocos confirmáveis (`confirmableBlockCount > 0`); sem eles, o seletor de período fica oculto e aparece o fallback "Sem dados ainda".
  - Sem rotina ativa, as seções "Agora" e do gráfico são substituídas por um **único fallback** ("Nenhuma rotina ativa").
  - Com rotina ativa mas **sem blocos confirmáveis e sem blocos no momento**, as duas seções viram um **único fallback** ("Nenhuma atividade para mostrar"); quando apenas um lado está vazio, as seções permanecem separadas (distinção "sem histórico" vs "nada agora").
  - O **carregamento inicial** usa um único spinner para a área de rotina (antes eram dois spinners empilhados); refetches continuam com spinner individual por seção.
  - O gráfico atualiza automaticamente ao confirmar um bloco.
  - **Tarefas**: seção sempre visível (independente de rotina ativa) com **uma tarefa por vez**, escolhida entre as pendentes por urgência combinada — score = urgência da data limite (atrasada 10–15, vence hoje 8–10, até 3 dias 6–8, até 7 dias 4–6, até ~1 mês 0–4, sem data 0) + prioridade (1–6), com desempate por data mais próxima, prioridade e criação (`frontend/lib/task-ordering.ts`).
  - O card da tarefa atual replica o do painel (checkbox, prioridade, data limite) sem ações de edição/exclusão; as sub-tarefas dela aparecem em árvore simplificada com checkbox (mesma regra de conclusão em cascata do painel) e as próximas (até 5) em linhas sem checkbox; concluir a tarefa atual promove a próxima automaticamente.
- **i18n** — Português e Inglês via `next-intl` (`frontend/messages/{pt,en}.json`), incluindo os nomes dos dias da semana (date-fns com locale).

## Pré-requisitos

- [Docker](https://www.docker.com/products/docker-desktop/) (Docker Engine + Compose) instalado e rodando.

## Como começar

Clone o repositório e suba o ambiente:

```bash
git clone <url-do-repositorio>
cd nextasks
docker compose up -d
```

A primeira execução demora mais (build da imagem + `npm ci`). Aguarde até todos os serviços estarem com healthcheck OK:

```bash
docker compose ps
```

Depois, acesse:

| Recurso      | URL                          |
|--------------|------------------------------|
| Aplicação    | http://localhost:3000        |
| phpMyAdmin   | http://localhost:8080        |

> No primeiro start, o container `next_app` executa `npx prisma db push` antes de iniciar a app, criando as tabelas no banco automaticamente.

## Comandos Docker essenciais

### Iniciar / parar

```bash
docker compose up -d          # sobe todos os serviços em segundo plano
docker compose start          # inicia serviços já criados (sem rebuild)
docker compose stop           # para os serviços, mantendo containers e volume
docker compose down           # remove os containers, mantém imagens e volume
docker compose down -v        # remove containers E apaga o volume (dados do banco)
```

### Rebuild (após mudanças no código)

```bash
docker compose build          # reconstrói as imagens
docker compose up -d --build  # build + sobe (combo mais usado)
```

Use `--no-cache` caso queira forçar o Docker a ignorar o cache e rebaixar dependências do zero:

```bash
docker compose build --no-cache
docker compose up -d --build --no-cache
```

### Estrutura de dados: acompanhar bancos

Pós mudanças no schema Prisma (`frontend/prisma/schema.prisma`), o `db push` roda automaticamente a cada `up -d`. Se precisar aplicar manualmente:

```bash
docker compose exec next_app npx prisma db push
docker compose exec next_app npx prisma generate
```

### Status e processos

```bash
docker compose ps                 # status dos serviços
docker compose top                # lista os processos de cada container
docker compose stats              # uso de CPU, memória e rede de cada container
```

### Logs

```bash
docker compose logs               # logs de todos os serviços
docker compose logs next_app      # logs só do frontend
docker compose logs -f next_app   # acompanhar em tempo real (follow)
docker compose logs --tail=100    # últimas 100 linhas
```

### Executar comandos dentro do container

```bash
docker compose exec next_app sh          # shell interativo no frontend
docker compose exec next_app npm test    # roda um comando dentro do container
```

### Serviço específico

```bash
docker compose up -d next_app           # sobe apenas o frontend
docker compose restart next_app         # reinicia o frontend
docker compose stop next_app            # para o frontend
```

## Onde acessar phpMyAdmin

- URL: http://localhost:8080
- Servidor / host: `mysql`
- Usuário: `app_user`
- Senha: `app123`

## Variáveis de ambiente

O frontend usa as variáveis de `frontend/.env` (copiadas para a imagem):

| Variável             | Valor                                    |
|----------------------|------------------------------------------|
| `DATABASE_URL`       | `mysql://app_user:app123@mysql:3306/app` |
| `BETTER_AUTH_SECRET` | chave secreta de autenticação            |
| `BETTER_AUTH_URL`    | `http://localhost:3000`                  |

## Volumes

- `mysql_data` → dados persistidos do banco (criado/gerenciado pelo Compose).

Para inspecionar ou apagar:

```bash
docker volume ls                # lista volumes
docker volume inspect mysql_data     # detalhes
docker volume rm mysql_data          # apaga os dados (é melhor usar down -v)
```

## Desenvolvimento local (sem Docker)

Para rodar o Next.js direto no host, o banco (não toque o `docker-compose` do MySQL) precisa estar rodando. Com o **MySQL/MariaDB** no ar:

```bash
cd frontend
npm ci
npx prisma db push
npm run dev
```

A app roda em http://localhost:3000.

## Rotas da API (Next.js App Router)

| Método  | Rota                | Descrição                              |
|---------|---------------------|----------------------------------------|
| GET     | `/api/routines`     | Lista as rotinas do usuário autenticado |
| POST    | `/api/routines`     | Cria uma rotina                        |
| PATCH   | `/api/routines/:id` | Atualiza uma rotina                    |
| DELETE  | `/api/routines/:id` | Exclui uma rotina                      |
| GET     | `/api/routines/:id/time-blocks` | Lista os blocos de tempo de uma rotina |
| POST    | `/api/routines/:id/time-blocks` | Cria um bloco de tempo           |
| PATCH   | `/api/routines/:id/time-blocks/:blockId` | Atualiza um bloco de tempo |
| DELETE  | `/api/routines/:id/time-blocks/:blockId` | Exclui um bloco de tempo   |
| GET     | `/api/routines/progress` | Progresso diário (0–100) da rotina ativa. Query: `days` (7/15/30/60, default 30) e `tzOffset` (minutos). Resposta: `{ routine, confirmableBlockCount, progress: [{ date, value, confirmableBlocks, confirmedValue }], period }` |
| GET     | `/api/tasks`     | Lista as tarefas do usuário autenticado |
| POST    | `/api/tasks`     | Cria uma tarefa                        |
| PATCH   | `/api/tasks/:id` | Atualiza uma tarefa (inclui `done`)    |
| DELETE  | `/api/tasks/:id` | Exclui uma tarefa                      |
| GET     | `/api/tasks/:id/subtasks` | Lista as sub-tarefas de uma tarefa como árvore aninhada |
| POST    | `/api/tasks/:id/subtasks` | Cria uma sub-tarefa (body pode incluir `parentId` para aninhar) |
| PATCH   | `/api/subtasks/:id` | Atualiza título/descrição de uma sub-tarefa |
| DELETE  | `/api/subtasks/:id` | Exclui uma sub-tarefa e toda a sub-árvore abaixo dela |
| POST    | `/api/routines/:id/duplicate` | Duplica uma rotina (com blocos de tempo) |
| POST    | `/api/routines/:id/activate` | Ativa/desativa uma rotina (só uma ativa por usuário) |
| POST    | `/api/time-blocks/:id/complete` | Confirma um bloco no período atual. Query: `tzOffset`. Body: `{ value }` ("true"/"false" para checkbox; "1"–"10" para nota). Propaga para entidades conectadas satisfeitas |
| GET     | `/api/connections` | Catálogo de conexões (tarefas, sub-tarefas, blocos com dia da semana local e conexões com `confirmedCount`). Query: `tzOffset` |
| POST    | `/api/connections` | Cria uma conexão (`{ taskId | subtaskId, timeBlockId, requiredCount?, dayFilter? }`) |
| PATCH   | `/api/connections/:id` | Atualiza `requiredCount`/`dayFilter` de uma conexão |
| DELETE  | `/api/connections/:id` | Remove uma conexão; se era o último obstáculo insatisfeito, a entidade completa (propagação no delete) |
| POST    | `/api/auth/[...all]` | Endpoints de autenticação (better-auth) |

Todas as rotas exigem autenticação. As rotinas validam o payload com a mesma regra compartilhada usada no frontend (`frontend/lib/validation/routines.ts`); os blocos de tempo validam com `parseTimeBlockInput`/`parseTimeBlockPatch` (`frontend/lib/validation/time-blocks.ts`); as tarefas validam com `parseTaskInput`/`parseTaskPatch` (`frontend/lib/validation/tasks.ts`); as sub-tarefas com `parseSubtaskInput`/`parseSubtaskPatch` (`frontend/lib/validation/subtasks.ts`); as conexões com `parseConnectionInput`/`parseConnectionPatch`/`parseDayFilter` (`frontend/lib/validation/connections.ts`). O progresso é calculado em `frontend/app/api/routines/progress/route.ts` usando os períodos de `frontend/lib/server/completions.ts`. A cascata de conclusão das tarefas/sub-tarefas vive em `frontend/lib/server/subtask-cascade.ts` e as conexões em `frontend/lib/server/connections.ts`.

## Modelo de dados

O esquema fica em `frontend/prisma/schema.prisma`. Além dos modelos do better-auth (`User`, `Session`, `Account`, `Verification`), existem:

```prisma
model Routine {
  id          String    @id @default(cuid())
  userId      String
  name        String
  description String?   @db.Text
  frequency   String    @default("daily")     // daily | weekly
  duration    String    @default("indefinite") // indefinite | until
  endDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  timeBlocks  TimeBlock[]

  @@index([userId])
}

model TimeBlock {
  id        String   @id @default(cuid())
  routineId String
  title     String
  start     DateTime
  end       DateTime
  isAllDay  Boolean  @default(false)
  color     String   @default("blue") // red | orange | yellow | green | blue | purple | gray
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  routine   Routine  @relation(fields: [routineId], references: [id], onDelete: Cascade)

  @@index([routineId])
}

model Task {
  id          String    @id @default(cuid())
  userId      String
  title       String
  description String?   @db.Text
  dueDate     DateTime?
  priority    Int       @default(3) // 1 (muito baixa) ate 6 (urgente)
  done        Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  subtasks    Subtask[]

  @@index([userId])
}

model Subtask {
  id          String    @id @default(cuid())
  taskId      String
  parentId    String?
  title       String
  description String?   @db.Text
  done        Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  task        Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  parent      Subtask?  @relation("SubtaskTree", fields: [parentId], references: [id], onDelete: Cascade)
  children    Subtask[] @relation("SubtaskTree")

  @@index([taskId])
  @@index([parentId])
}

model TaskBlockConnection {
  id            String    @id @default(cuid())
  userId        String
  taskId        String?   // exatamente um de taskId/subtaskId é preenchido
  subtaskId     String?
  timeBlockId   String
  requiredCount Int       @default(1)   // confirmações necessárias (histórico)
  dayFilter     String    @default("all") // all | weekday:N (0-6) | date:YYYY-MM-DD
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  task          Task?     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  subtask       Subtask?  @relation(fields: [subtaskId], references: [id], onDelete: Cascade)
  timeBlock     TimeBlock @relation(fields: [timeBlockId], references: [id], onDelete: Cascade)
  @@unique([taskId, timeBlockId])      // unicidade (1 de taskId/subtaskId não-nulo)
  @@unique([subtaskId, timeBlockId])

  @@index([userId])
  @@index([timeBlockId])
  @@index([taskId])
  @@index([subtaskId])
}
```

Tabelas são criadas/atualizadas automaticamente via `prisma db push` no start do container.

## Problemas comuns

### A porta 3000 ou 8080 já está em uso
- Pode estar ocupada por outra instância. Verifique com `docker ps` ou pare o processo na porta.

### O container do frontend reinicia em loop
- Veja os logs: `docker compose logs next_app`. Geralmente é erro de conexão com o banco (aguarde o healthcheck do MySQL) ou erro de schema Prisma.

### Alterei o código mas nada muda
- O `Dockerfile` copia o código na build. Use `docker compose up -d --build` para recompilar.

## Comandos rápido de manutenção

```bash
docker compose up -d --build   # rebuild + sobe (pós-mudança de código)
docker compose ps              # status dos containers
docker compose logs -f         # acompanhar logs
docker compose down            # parar tudo (preserva dados)
docker compose down -v         # parar tudo + apagar dados do banco
```

## Referências

- [Next.js](https://nextjs.org)
- [Prisma](https://www.prisma.io)
- [Docker Compose](https://docs.docker.com/compose/)