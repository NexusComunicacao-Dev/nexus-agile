# Work Manager (esqueleto)

- Next.js (App Router) + Tailwind.
- Páginas: `/board` (Kanban mock) e `/poker` (Planning Poker mock).
- Objetivo: validar UX e escopo. Depois: DB, Auth, Realtime, RBAC e Sprints.

## Funcionalidades atuais

- Kanban básico (DnD).
- Planning Poker (mock).
- Sprints:
  - Backlog com criação de histórias (título, descrição, responsáveis, prioridade, pontos, tags).
  - Iniciar/Finalizar sprint.
  - Adicionar/remover histórias entre backlog e sprint.
  - Histórico de sprints finalizadas.

Rotas:

- `/board`, `/poker`, `/sprints`.

## Rodar local

```bash
pnpm dev
# ou npm/yarn/bun
```

Abra http://localhost:3000.

## Hospedagem na Vercel

- App + APIs serverless: Vercel (Edge/Node).
- Banco: Postgres gerenciado (Vercel Postgres/Neon/Supabase) com TLS.
- Segredos: variáveis de ambiente por ambiente (Development/Preview/Production).

## Segurança (resumo)

- Sessão em cookie HttpOnly + SameSite.
- Nada de chaves no cliente; use rotas/ações no servidor.
- Banco com usuários por ambiente, roles mínimas, backups, RLS (quando aplicável).
- Auditoria (tabela events) e logs estruturados.

## Banco de dados (MongoDB Atlas) + Auth.js
1) Crie um Cluster/DB no MongoDB Atlas e gere uma connection string (SRV).
2) Variáveis de ambiente (Development/Production):
```
MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority&appName=<app>"
MONGODB_DB="nexus_agile"
AUTH_SECRET="<openssl rand -hex 32>"
# Opcional (OAuth)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```
3) Auth.js
- Usa MongoDBAdapter com o driver oficial.
- Se GOOGLE_* estiver configurado, usa Google OAuth; senão, fallback Credentials (apenas dev).

4) Proteção de rotas
- Após validar o login, adicione middleware/guards conforme necessidade (ex.: bloquear /board e /sprints para anônimos).

## Próximos passos (reais)

1. ORM e DB
   - `npm i prisma @prisma/client` e configurar Postgres.
   - Modelos: users, orgs, projects, sprints, issues, votes, events (audit).
   - Migrações + seed.
2. Auth
   - `npm i next-auth` (Auth.js). Providers (OAuth/Email).
   - Proteção de rotas e RBAC (owner/admin/member).
3. Tempo real
   - Planning Poker e Kanban com Vercel Realtime/Ably/Pusher.
4. Sprints e relatórios
   - Backlog, planejamento, histórico, métricas (throughput, lead time, burn-down).
5. Migrar Sprints/Stories do localStorage para coleções Mongo (organizations, users, projects, sprints, stories, story_events, poker_sessions, poker_votes).
6. Criar rotas (Route Handlers) ou Server Actions para CRUD e eventos de transição (auditoria).
7. Tempo real: Vercel Realtime/Ably/Pusher para Kanban/Poker multiusuário.

## Administração de usuários (promover/rebaixar)

- Endpoints protegidos (precisa estar logado e autorizado):
  - POST /api/admin/users   — promove um usuário a admin.
  - DELETE /api/admin/users — rebaixa um usuário (remove admin).
- Corpo (JSON):
  - { "email": "usuario@empresa.com" }

Bootstrap
- Se não existe nenhum admin ainda, o primeiro usuário logado pode se promover chamando POST com seu próprio e-mail.
- Opcional: use ADMIN_SEED_EMAILS para permitir que e-mails listados promovam (seed inicial).

Variáveis no .env.local:
```
# lista separada por vírgula
ADMIN_SEED_EMAILS="seu-email@empresa.com,outro@empresa.com"
```

Como chamar (após login)

Console do navegador (F12 > Console):
```js
// Promover
fetch("/api/admin/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "usuario@empresa.com" })
}).then(r => r.json()).then(console.log);

// Rebaixar
fetch("/api/admin/users", {
  method: "DELETE",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "usuario@empresa.com" })
}).then(r => r.json()).then(console.log);
```

cURL (requer cookie de sessão do NextAuth)
1) Obtenha o cookie de sessão no navegador (Application > Cookies > next-auth.session-token).
2) Use no header Cookie:
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=SEU_TOKEN_AQUI" \
  -d '{"email":"usuario@empresa.com"}'
```

Notas
- Após promover/rebaixar, peça para o usuário sair e entrar novamente para refletir admin na sessão.
- Apenas admins podem criar projetos (quando ALLOW_PROJECT_SELF_CREATE != "true"). Caso contrário, siga a política via envs.

## E-mail / Notificações

Variáveis necessárias:
```
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=senha
MAIL_FROM="Nexus Agile <no-reply@seudominio.com>"
APP_BASE_URL="http://localhost:3000" # ou URL de produção
ADMIN_REQUEST_NOTIFY_SUBJECT="Novo pedido de admin"
```

Fallback:
- Se qualquer variável SMTP estiver ausente, o envio vira log (console) para desenvolvimento.

Eventos implementados:
- Adição de membro ao projeto: e-mail para o usuário adicionado com link para /projects.
- Pedido de admin (rota POST /api/admin/requests): e-mail para todos admins.

Pedidos de admin:
- POST /api/admin/requests  { "reason": "Preciso gerenciar projetos" }
- GET  /api/admin/requests   (apenas admins)
- PATCH /api/admin/requests  { "id": "<id>", "status": "approved" | "rejected" } (não promove automaticamente)
- Promoção real continua via:
  - POST /api/admin/users { "email": "user@empresa.com" }

Ordem recomendada:
1. Usuário pede admin (POST /api/admin/requests).
2. Admin avalia (GET /api/admin/requests) e decide (PATCH).
3. Admin promove via rota /api/admin/users (POST) se aprovado.
