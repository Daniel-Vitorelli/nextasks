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
- **i18n** — Português e Inglês via `next-intl` (`frontend/messages/{pt,en}.json`).

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
| POST    | `/api/auth/[...all]` | Endpoints de autenticação (better-auth) |

Todas as rotas exigem autenticação. As rotinas validam o payload com a mesma regra compartilhada usada no frontend (`frontend/lib/routines.ts`).

## Modelo de dados

O esquema fica em `frontend/prisma/schema.prisma`. Além dos modelos do better-auth (`User`, `Session`, `Account`, `Verification`), existe:

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

  @@index([userId])
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