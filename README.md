# VetVAX — Agenda + Baixa + Lembretes (multi-tenant)

Este repositório contém o **VetVAX**, um sistema SaaS multi-tenant para **agenda + vendas/baixa de vacinação** (cães e gatos), com:
- Supabase (**Auth + Postgres + RLS**) e RPCs para operações críticas
- Frontend React + TypeScript + Tailwind + shadcn/ui
- UX premium: sidebar/topbar, tabelas, modais, empty/loading states, **Cmd+K** global search
- Timezone padrão: **America/Sao_Paulo** (dayjs)

> Observação: este projeto está estruturado em React (Vite) + React Router. A camada de backend e dados segue o desenho Supabase/RLS/RPC solicitado.

---

## 1) Criar projeto Supabase

1. Crie um projeto no Supabase.
2. Em **Authentication → Providers**, habilite **Email**.
3. Em **SQL Editor**, aplique as migrações do diretório `supabase/migrations`.

### Migração principal
- `supabase/migrations/0001_vetvax_init.sql`
  - Tabelas multi-tenant (`organizations`, `profiles`, `tutors`, `pets`, `catalog_items`, `appointments`, `appointment_items`, `appointment_checkouts`, `reminders`, etc.)
  - **RLS** habilitado em todas as tabelas com `org_id`
  - Helpers `get_my_org_id()`, `get_my_role()` e checks de RBAC
  - Triggers de `updated_at`
  - Trigger de `auth.users` → cria `profiles` automaticamente
  - Trigger na baixa para: snapshot, atualizar status e criar reminders
  - RPCs:
    - `onboard_create_org(payload jsonb)`
    - `create_appointment_with_items(payload jsonb)`
    - `checkout_appointment(payload jsonb)`
    - `merge_tutors(old_id, new_id)`
  - Views:
    - `vw_upcoming_appointments`
    - `vw_due_reminders`
    - `vw_dashboard_kpis`

---

## 2) Variáveis de ambiente (frontend)

Configure no ambiente (local/Vercel):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 3) Primeiro acesso (Admin + Org)

1. Abra a aplicação.
2. Crie uma conta (Sign Up) e faça login.
3. Você será direcionado(a) ao **Onboarding**.
4. No onboarding, o sistema chama a RPC `onboard_create_org` e:
   - cria a `organization`
   - opcionalmente cria `branch`
   - promove seu `profile` para **admin**
   - cria `org_settings`
   - **seeda** `catalog_items` e `message_templates`

---

## 4) Módulos implementados (MVP avançado)

### Dashboard
- KPIs (view `vw_dashboard_kpis`)
- **Próximos agendamentos** (view `vw_upcoming_appointments`)
  - ações: **Dar baixa**, Reagendar (duplica), Whats
- **Lembretes** (view `vw_due_reminders`)
  - texto inteligente: vencimento + última aplicação
  - ações: Whats (com anti-spam 24h), Marcar como feito, Arquivar

### Tutores + Pets
- Listagem com busca
- Detalhe com:
  - contato/endereço/tags/consentimento
  - CRUD de pets
  - timeline simples (últimos 15 agendamentos + lembretes)

### Agendamentos
- Form com:
  - Tutor (autocomplete + criar inline)
  - itens dinâmicos
  - toggle separar por pets
- Salva via RPC **`create_appointment_with_items`**

### Baixa (Checkout)
- Modal com status (APLICADO/CANCELADO)
- Data de baixa
- Próxima aplicação (opcional) → gera **lembrete** automaticamente (trigger)
- Opção “criar lembrete por item”
- Salva via RPC **`checkout_appointment`**

### Catálogo (Admin)
- CRUD de itens por org (RLS admin-only)

### Configurações (Admin/Manager)
- Atualiza `org_settings`

### Relatórios
- Export CSV de agendamentos (client-side) com filtros por período/status

---

## 5) Edge Functions (arquitetura preparada)

Existe um esqueleto para uma função `send-message` (para evoluir de wa.me para WhatsApp Cloud API/Twilio/360dialog), sem credenciais.

---

## 6) Deploy

### Supabase
- Migrações aplicadas
- Auth Email habilitado

### Vercel
- Configure as env vars `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Deploy do frontend

---

## 7) Checklist de aceite (cenários)

- [ ] Login funcionando
- [ ] Onboarding cria org + seeds (catálogo + template)
- [ ] CRUD Tutor
- [ ] CRUD Pet opcional dentro do tutor
- [ ] Criar agendamento unificado
- [ ] Criar agendamento separando por pet
- [ ] Dashboard lista pendentes no período
- [ ] Baixa “APLICADO” remove dos pendentes e atualiza status
- [ ] Baixa com próxima data cria lembrete (dashboard mostra)
- [ ] Whats abre wa.me com mensagem preenchida
- [ ] Export CSV gera arquivo
- [ ] RLS impede leitura entre organizações
- [ ] Audit log registra inserts/updates/deletes em tutors/appointments/reminders

---

## Estrutura

- `src/pages/*` páginas
- `src/components/*` componentes
- `src/lib/*` utilitários (supabase, telefone, template, datetime)
- `src/types/*` types
- `supabase/migrations/*` SQL migrations
- `supabase/functions/*` edge functions (placeholder)
