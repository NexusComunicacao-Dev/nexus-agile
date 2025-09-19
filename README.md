# Nexus Agile (Work Manager)

Gerenciamento colaborativo de trabalho: Projetos, Sprints com métricas (Lead Time), Board Kanban, Planning Poker, convites e fluxo de acesso com e-mails estilizados.

## Stack

- Next.js (App Router) + Route Handlers (APIs)
- Auth.js (NextAuth) com MongoDB Adapter
- MongoDB Atlas
- Tailwind (via @import) + design tokens (CSS vars / paleta #FF7C1A)
- Emails HTML custom (template centralizado)
- Nodemailer (smtp ou modo log)

## Principais Recursos

- Projetos: criação, convite por e-mail, remoção de membros, seleção persistida (localStorage)
- Sprints: backlog, mover histórias, iniciar/finalizar, objetivo, métricas agregadas
- Métricas:
  - Lead Time por história (estágios: todo → doing → testing → awaiting deploy → deployed → done)
  - Média, variação vs alvo, % dentro do alvo
- Board: visão Kanban de histórias em sprint (drag & drop)
- Planning Poker: sessão ativa, votos (deck Fibonacci), reveal/reset, sugestão de pontos baseada na média + arredondamento Fibonacci
- Comentários em histórias
- Atribuição de responsável (assignee)
- Admin:
  - Pedidos de elevação (workflow: request → review → promote manual)
  - Gestão de convites pendentes (reenvio/cancelamento)
  - Promoção / Rebaixamento de usuários
- Convites de projeto + aceitação automática no primeiro login (processa convites pendentes)
- E-mails com template visual (gradiente brand, botão CTA, preheader)
- Paleta global (#FF7C1A / #888888) aplicada em toda a interface

## Estrutura (principais pastas)

```
src/
  app/
    api/              # Route Handlers (REST)
      projects/
      sprints/
      stories/
      admin/
      poker/
    board/            # Página Kanban
    poker/            # Página Planning Poker
    sprints/          # Listagem / criação
      [id]/           # Detalhe + métricas
    projects/         # Lista + criação
      [id]/settings/  # Configurações do projeto
    admin/            # Painel administrativo
    layout.tsx        # Layout global + tokens
    nav-client.tsx
    page.tsx          # Home
  lib/
    auth.ts           # Config Auth.js
    db.ts / mongodb.ts
    email-template.ts # Template de e-mail (HTML + texto)
    mailer.ts
```

## Páginas Principais

| Página | Descrição |
|--------|-----------|
| / | Home / atalhos |
| /projects | Listagem + criação |
| /projects/[id]/settings | Gerir membros / exclusão |
| /sprints | Backlog + sprint ativa |
| /sprints/[id] | Métricas detalhadas (lead time) |
| /board | Kanban (status fluxo) |
| /poker | Planning Poker |
| /admin | Gestão admin + convites |

## Fluxo de Sprints

1. Criar histórias no backlog
2. Iniciar sprint (admin)
3. Mover histórias para sprint
4. Atualizar status no Board ou modal
5. Finalizar sprint → vai para histórico
6. Consultar métricas (lead time por estágio + média vs SLA)

Lead Time:
- Calculado analisando `story.history` (linhas status/tempo)
- SLA alvo configurado no código (LEAD_TARGET_DAYS)
- Variance = totalDays - target

## Planning Poker

- Uma sessão ativa por projeto
- Seleção de história ativa
- Votos ocultos até “Revelar”
- Média numérica + sugestão Fibonacci mais próxima
- Aplicar pontos (PATCH) salva em story.points
- Reset limpa votos e volta a estado oculto

## E-mails

Eventos:
- Convite de projeto
- Adicionado ao projeto
- Pedido de admin (notifica todos admins)
- Reenvio de convite (admin)
Template central: `src/lib/email-template.ts`

Modo log (fallback) se faltar credenciais SMTP:
```
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
```

## Variáveis de Ambiente

Obrigatórias mínimas:
```
MONGODB_URI=
MONGODB_DB=nexus_agile
AUTH_SECRET= # openssl rand -hex 32
```

Opcionais:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

ALLOWED_EMAILS=          # lista separada por vírgula (whitelist)
ALLOWED_EMAIL_DOMAINS=   # ex: empresa.com,provedor.org
ADMIN_SEED_EMAILS=       # bootstrap admins

APP_BASE_URL=http://localhost:3000
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Nexus Agile <no-reply@dominio.com>"
```

## Bootstrap de Admin

1. Defina `ADMIN_SEED_EMAILS` ou deixe sem admin → primeiro login promove automaticamente (fallback)
2. Demais usuários pedem elevação em /projects (botão “Solicitar admin”)
3. Admin revisa em /admin (requests) e promove via `/api/admin/users` (UI botão Promover)

## Comandos

Instalação:
```bash
pnpm i
```

Dev:
```bash
pnpm dev
```

Build / Start:
```bash
pnpm build && pnpm start
```

## Rotas de API (resumo essencial)

| Método / Rota | Função |
|---------------|--------|
| POST /api/projects | Criar projeto |
| GET /api/projects | Listar projetos do usuário |
| GET /api/projects/:id?includeMembers=1 | Detalhe + membros |
| POST /api/projects/:id/members | Convidar/adicionar |
| DELETE /api/projects/:id/members?memberId= | Remover membro |
| GET /api/projects/:id/sprints | Listar + ativa |
| POST /api/projects/:id/sprints | Criar sprint |
| PATCH /api/sprints/:id | Finalizar |
| GET /api/sprints/:id | Métricas + histórias |
| POST /api/sprints/backlog/stories | Criar história backlog |
| PATCH /api/stories/:id | Editar (status, pontos, descrição, assignee) |
| DELETE /api/stories/:id | Excluir |
| POST /api/stories/:id/comments | Comentar |
| GET/POST/PATCH /api/projects/:projectId/poker | Sessão poker |
| POST /api/poker/:sessionId/vote | Registrar voto |
| POST /api/poker/:sessionId/apply | Aplicar pontos |
| POST /api/admin/requests | Criar pedido admin |
| GET /api/admin/requests | Listar pedidos |
| PATCH /api/admin/requests | Atualizar status pedido |
| POST /api/admin/users | Promover |
| DELETE /api/admin/users | Rebaixar |
| GET /api/admin/invitations | Convites pendentes |
| POST /api/admin/invitations | Reenviar convite |
| DELETE /api/admin/invitations | Cancelar convite |

## Métricas de Sprint

Campos retornados em `/api/sprints/:id`:
```
metrics: {
  totalStories,
  doneStories,
  progressPct,
  totalPoints,
  completedPoints,
  velocity,
  avgLeadDays,
  leadTargetDays,
  leadWithinTarget,
  leadWithinTargetPct
}
stories[].lead: {
  perStatus: { todo:{days}, ... },
  total:{days},
  targetDays,
  varianceDays,
  withinTarget
}
```

## Segurança / Acesso

- Filtro de e-mails/domínios (whitelist) opcional (ALLOWED_EMAILS / ALLOWED_EMAIL_DOMAINS)
- Sessão JWT (Auth.js) com flag admin injetada via callback
- Convites: só owner adiciona diretamente; pendentes aceitos ao primeiro login
- Rotas admin: checam flag `admin` no usuário

## Estilo / UI

- Paleta central (variáveis CSS) definida em `layout.tsx`
- Componentes utilitários: `.btn-primary`, `.badge-brand`, `.card-surface`
- Scrollbar e foco customizados (acessibilidade básica)
- Ícones substituídos por marca (logo + gradiente)

## Próximos Passos (possíveis)

- Audit log (events)
- Burn-down / throughput charts
- Subtarefas / épicos
- Export (CSV / JSON)
- Realtime (Pusher / Vercel Realtime) para Board e Poker
- Testes e2e (Playwright)

## Desenvolvimento Rápido

1. Configurar `.env.local`
2. Rodar `pnpm dev`
3. Criar projeto em /projects
4. Iniciar sprint em /sprints
5. Abrir /board para fluxo
6. Estimar em /poker
7. Revisar métricas: /sprints/:id

---

