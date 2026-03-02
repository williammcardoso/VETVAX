-- VetVAX (multi-tenant) - initial schema
-- Timezone padrão recomendado: America/Sao_Paulo (definido por org_settings)

create extension if not exists "pgcrypto";

-- =========================
-- Helpers
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- Core tables
-- =========================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_branches_org on public.branches(org_id);

create trigger trg_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  role text not null default 'viewer' check (role in ('admin','manager','staff','viewer')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_org on public.profiles(org_id);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Create profile stub on user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================
-- Org settings + templates
-- =========================
create table if not exists public.org_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  store_name text not null,
  store_phone text,
  store_address text,
  timezone text not null default 'America/Sao_Paulo',
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create trigger trg_org_settings_updated_at
before update on public.org_settings
for each row execute function public.set_updated_at();

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','email')),
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_message_templates_org on public.message_templates(org_id);

create trigger trg_message_templates_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

-- =========================
-- Tutors / Pets
-- =========================
create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,

  name text not null,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  uf text,
  phone1 text,
  phone2 text,
  notes text,
  tags text[] not null default '{}'::text[],
  contact_consent boolean not null default false,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_tutors_org on public.tutors(org_id);
create index if not exists idx_tutors_org_name on public.tutors(org_id, name);
create index if not exists idx_tutors_org_phone1 on public.tutors(org_id, phone1);

-- unique phone1 per org when provided
create unique index if not exists uniq_tutors_org_phone1
on public.tutors(org_id, phone1)
where phone1 is not null and phone1 <> '';

create trigger trg_tutors_updated_at
before update on public.tutors
for each row execute function public.set_updated_at();

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tutor_id uuid not null references public.tutors(id) on delete cascade,

  name text not null,
  species text not null default 'dog' check (species in ('dog','cat','other')),
  age_text text,
  birth_date date,
  breed text,
  color text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_pets_org on public.pets(org_id);
create index if not exists idx_pets_tutor on public.pets(tutor_id);

create trigger trg_pets_updated_at
before update on public.pets
for each row execute function public.set_updated_at();

-- =========================
-- Catalog
-- =========================
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'vaccine' check (category in ('vaccine','medication','other')),
  requires_description boolean not null default false,
  allows_origin boolean not null default false,
  default_origin text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_items_org on public.catalog_items(org_id);

create trigger trg_catalog_items_updated_at
before update on public.catalog_items
for each row execute function public.set_updated_at();

-- =========================
-- Appointments / Items / Checkouts
-- =========================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tutor_id uuid not null references public.tutors(id) on delete restrict,

  scheduled_date date not null,
  scheduled_time time not null,
  channel text not null default 'store' check (channel in ('store','phone','whatsapp','other')),
  notes text,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','APLICADO','CANCELADO')),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_appointments_org_status_date on public.appointments(org_id, status, scheduled_date, scheduled_time);
create index if not exists idx_appointments_tutor on public.appointments(tutor_id);

create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create table if not exists public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  pet_id uuid references public.pets(id) on delete set null,

  quantity int not null check (quantity > 0),
  free_description text,
  price_cents int,
  brand text,
  lot text,
  expires_on date,
  metadata jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointment_items_org on public.appointment_items(org_id);
create index if not exists idx_appointment_items_appointment on public.appointment_items(appointment_id);

create trigger trg_appointment_items_updated_at
before update on public.appointment_items
for each row execute function public.set_updated_at();

create table if not exists public.appointment_checkouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null unique references public.appointments(id) on delete restrict,

  status_result text not null check (status_result in ('APLICADO','CANCELADO')),
  checkout_date date not null,
  notes text,

  next_due_date date,
  next_due_pet_id uuid references public.pets(id) on delete set null,
  create_item_reminders boolean not null default false,

  applied_items_snapshot jsonb not null default '[]'::jsonb,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checkouts_org_date on public.appointment_checkouts(org_id, checkout_date);

create trigger trg_checkouts_updated_at
before update on public.appointment_checkouts
for each row execute function public.set_updated_at();

-- snapshot BEFORE INSERT
create or replace function public.checkout_snapshot_items()
returns trigger
language plpgsql
as $$
declare
  v_snapshot jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ai.id,
        'catalog_item_id', ai.catalog_item_id,
        'catalog_name', ci.name,
        'category', ci.category,
        'pet_id', ai.pet_id,
        'quantity', ai.quantity,
        'free_description', ai.free_description,
        'price_cents', ai.price_cents,
        'brand', ai.brand,
        'lot', ai.lot,
        'expires_on', ai.expires_on,
        'metadata', ai.metadata
      )
      order by ai.created_at asc
    ),
    '[]'::jsonb
  )
  into v_snapshot
  from public.appointment_items ai
  join public.catalog_items ci on ci.id = ai.catalog_item_id
  where ai.appointment_id = new.appointment_id;

  new.applied_items_snapshot = v_snapshot;
  return new;
end;
$$;

drop trigger if exists trg_checkouts_snapshot_items on public.appointment_checkouts;
create trigger trg_checkouts_snapshot_items
before insert on public.appointment_checkouts
for each row execute function public.checkout_snapshot_items();

-- checkout AFTER INSERT: update appointment status + create reminder(s)
create or replace function public.handle_checkout_insert()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_tutor_id uuid;
  v_pet_override uuid;
  v_item record;
  v_any_item jsonb;
  v_reminder_type text;
begin
  select a.org_id, a.branch_id, a.tutor_id
    into v_org_id, v_branch_id, v_tutor_id
  from public.appointments a
  where a.id = new.appointment_id;

  update public.appointments
    set status = new.status_result,
        updated_at = now()
  where id = new.appointment_id;

  if new.next_due_date is null then
    return new;
  end if;

  v_pet_override := new.next_due_pet_id;

  if new.create_item_reminders then
    for v_item in
      select ai.pet_id, ci.category
      from public.appointment_items ai
      join public.catalog_items ci on ci.id = ai.catalog_item_id
      where ai.appointment_id = new.appointment_id
    loop
      v_reminder_type := case v_item.category
        when 'vaccine' then 'vacina'
        when 'medication' then 'medicação'
        else 'outro'
      end;

      insert into public.reminders(
        org_id, branch_id, tutor_id, pet_id, due_date,
        reference_appointment_id, last_applied_at,
        reminder_type, status, notes
      )
      values(
        v_org_id, v_branch_id, v_tutor_id,
        coalesce(v_pet_override, v_item.pet_id),
        new.next_due_date,
        new.appointment_id,
        new.checkout_date,
        v_reminder_type,
        'ATIVO',
        null
      );
    end loop;
  else
    select (new.applied_items_snapshot -> 0) into v_any_item;

    v_reminder_type := case (v_any_item ->> 'category')
      when 'vaccine' then 'vacina'
      when 'medication' then 'medicação'
      else 'outro'
    end;

    insert into public.reminders(
      org_id, branch_id, tutor_id, pet_id, due_date,
      reference_appointment_id, last_applied_at,
      reminder_type, status, notes
    )
    values(
      v_org_id, v_branch_id, v_tutor_id,
      v_pet_override,
      new.next_due_date,
      new.appointment_id,
      new.checkout_date,
      coalesce(v_reminder_type, 'vacina'),
      'ATIVO',
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_checkouts_handle_insert on public.appointment_checkouts;
create trigger trg_checkouts_handle_insert
after insert on public.appointment_checkouts
for each row execute function public.handle_checkout_insert();

-- =========================
-- Reminders + Outbox
-- =========================
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,

  due_date date not null,
  reference_appointment_id uuid references public.appointments(id) on delete set null,
  last_applied_at date,
  reminder_type text not null default 'vacina',
  message_template_id uuid references public.message_templates(id) on delete set null,

  status text not null default 'ATIVO' check (status in ('ATIVO','FEITO','ARQUIVADO')),
  last_sent_at timestamptz,
  send_count int not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_reminders_org_due on public.reminders(org_id, status, due_date);
create index if not exists idx_reminders_tutor on public.reminders(tutor_id);

create trigger trg_reminders_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

create table if not exists public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'wa.me',
  channel text not null default 'whatsapp' check (channel in ('whatsapp','email')),
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','CANCELLED')),
  payload jsonb not null default '{}'::jsonb,
  error text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outbox_org_status on public.message_outbox(org_id, status, scheduled_for);

create trigger trg_outbox_updated_at
before update on public.message_outbox
for each row execute function public.set_updated_at();

-- =========================
-- Invites / Exports / Audit
-- =========================
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin','manager','staff','viewer')),
  branch_id uuid references public.branches(id) on delete set null,
  token text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (org_id, email)
);

create index if not exists idx_invites_org on public.invites(org_id);

create trigger trg_invites_updated_at
before update on public.invites
for each row execute function public.set_updated_at();

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  kind text not null default 'appointments',
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','DONE','FAILED')),
  storage_path text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_export_jobs_org on public.export_jobs(org_id, status);

create trigger trg_export_jobs_updated_at
before update on public.export_jobs
for each row execute function public.set_updated_at();

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_org_created on public.audit_log(org_id, created_at desc);

-- Generic audit trigger
create or replace function public.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
  v_action text;
begin
  v_action := tg_op;

  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_before := null;
    v_entity_id := new.id;
    v_org_id := new.org_id;
  elsif tg_op = 'UPDATE' then
    v_after := to_jsonb(new);
    v_before := to_jsonb(old);
    v_entity_id := new.id;
    v_org_id := new.org_id;
  elsif tg_op = 'DELETE' then
    v_after := null;
    v_before := to_jsonb(old);
    v_entity_id := old.id;
    v_org_id := old.org_id;
  end if;

  insert into public.audit_log(org_id, action, entity, entity_id, before, after, actor_id)
  values (v_org_id, v_action, tg_table_name, v_entity_id, v_before, v_after, auth.uid());

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_tutors on public.tutors;
create trigger trg_audit_tutors
after insert or update or delete on public.tutors
for each row execute function public.audit_changes();

drop trigger if exists trg_audit_appointments on public.appointments;
create trigger trg_audit_appointments
after insert or update or delete on public.appointments
for each row execute function public.audit_changes();

drop trigger if exists trg_audit_reminders on public.reminders;
create trigger trg_audit_reminders
after insert or update or delete on public.reminders
for each row execute function public.audit_changes();

-- =========================
-- RLS helpers
-- =========================
create or replace function public.get_my_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role in ('admin','manager') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff_or_higher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role in ('admin','manager','staff') from public.profiles where id = auth.uid()), false);
$$;

-- =========================
-- RLS enable
-- =========================
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.org_settings enable row level security;
alter table public.message_templates enable row level security;
alter table public.tutors enable row level security;
alter table public.pets enable row level security;
alter table public.catalog_items enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.appointment_checkouts enable row level security;
alter table public.reminders enable row level security;
alter table public.message_outbox enable row level security;
alter table public.invites enable row level security;
alter table public.export_jobs enable row level security;
alter table public.audit_log enable row level security;

-- =========================
-- RLS policies (default org match)
-- =========================
-- organizations: only members can select
create policy org_select on public.organizations
for select
using (id = public.get_my_org_id());

-- branches
create policy branches_select on public.branches
for select
using (org_id = public.get_my_org_id());

create policy branches_write on public.branches
for insert
with check (org_id = public.get_my_org_id() and public.is_manager_or_admin());

create policy branches_update on public.branches
for update
using (org_id = public.get_my_org_id() and public.is_manager_or_admin())
with check (org_id = public.get_my_org_id() and public.is_manager_or_admin());

create policy branches_delete on public.branches
for delete
using (org_id = public.get_my_org_id() and public.is_manager_or_admin());

-- profiles
create policy profiles_select_self on public.profiles
for select
using (id = auth.uid());

create policy profiles_update_self on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- org_settings (manager/admin)
create policy org_settings_select on public.org_settings
for select
using (org_id = public.get_my_org_id());

create policy org_settings_write on public.org_settings
for insert
with check (org_id = public.get_my_org_id() and public.is_manager_or_admin());

create policy org_settings_update on public.org_settings
for update
using (org_id = public.get_my_org_id() and public.is_manager_or_admin())
with check (org_id = public.get_my_org_id() and public.is_manager_or_admin());

-- message_templates (manager/admin)
create policy templates_select on public.message_templates
for select
using (org_id = public.get_my_org_id());

create policy templates_write on public.message_templates
for insert
with check (org_id = public.get_my_org_id() and public.is_manager_or_admin());

create policy templates_update on public.message_templates
for update
using (org_id = public.get_my_org_id() and public.is_manager_or_admin())
with check (org_id = public.get_my_org_id() and public.is_manager_or_admin());

-- tutors
create policy tutors_select on public.tutors
for select
using (org_id = public.get_my_org_id());

create policy tutors_write on public.tutors
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

create policy tutors_update on public.tutors
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

-- pets
create policy pets_select on public.pets
for select
using (org_id = public.get_my_org_id());

create policy pets_write on public.pets
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

create policy pets_update on public.pets
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

-- catalog_items (admin only)
create policy catalog_select on public.catalog_items
for select
using (org_id = public.get_my_org_id());

create policy catalog_write on public.catalog_items
for insert
with check (org_id = public.get_my_org_id() and public.is_admin());

create policy catalog_update on public.catalog_items
for update
using (org_id = public.get_my_org_id() and public.is_admin())
with check (org_id = public.get_my_org_id() and public.is_admin());

-- appointments
create policy appointments_select on public.appointments
for select
using (org_id = public.get_my_org_id());

create policy appointments_write on public.appointments
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

create policy appointments_update on public.appointments
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

-- appointment_items
create policy appointment_items_select on public.appointment_items
for select
using (org_id = public.get_my_org_id());

create policy appointment_items_write on public.appointment_items
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

create policy appointment_items_update on public.appointment_items
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

-- checkouts
create policy checkouts_select on public.appointment_checkouts
for select
using (org_id = public.get_my_org_id());

create policy checkouts_write on public.appointment_checkouts
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

-- reminders
create policy reminders_select on public.reminders
for select
using (org_id = public.get_my_org_id());

create policy reminders_write on public.reminders
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

create policy reminders_update on public.reminders
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

-- outbox (manager/admin)
create policy outbox_select on public.message_outbox
for select
using (org_id = public.get_my_org_id() and public.is_manager_or_admin());

create policy outbox_write on public.message_outbox
for insert
with check (org_id = public.get_my_org_id() and public.is_manager_or_admin());

-- invites (admin)
create policy invites_all on public.invites
for all
using (org_id = public.get_my_org_id() and public.is_admin())
with check (org_id = public.get_my_org_id() and public.is_admin());

-- export_jobs (staff+ can create, owner can read)
create policy export_jobs_select on public.export_jobs
for select
using (org_id = public.get_my_org_id());

create policy export_jobs_write on public.export_jobs
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

-- audit_log (manager/admin view)
create policy audit_select on public.audit_log
for select
using (org_id = public.get_my_org_id() and public.is_manager_or_admin());

-- =========================
-- RPCs
-- =========================
create or replace function public.onboard_create_org(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_store_name text;
  v_branch_name text;
begin
  v_store_name := coalesce(payload->>'store_name', 'VetVAX');
  v_branch_name := nullif(payload->>'branch_name','');

  insert into public.organizations(name, created_by)
  values (v_store_name, auth.uid())
  returning id into v_org_id;

  if v_branch_name is not null then
    insert into public.branches(org_id, name)
    values (v_org_id, v_branch_name)
    returning id into v_branch_id;
  end if;

  update public.profiles
    set org_id = v_org_id,
        branch_id = v_branch_id,
        role = 'admin',
        display_name = coalesce(payload->>'display_name', display_name),
        updated_at = now()
  where id = auth.uid();

  insert into public.org_settings(org_id, store_name, store_phone, store_address, timezone, branding)
  values (
    v_org_id,
    v_store_name,
    nullif(payload->>'store_phone',''),
    nullif(payload->>'store_address',''),
    coalesce(nullif(payload->>'timezone',''), 'America/Sao_Paulo'),
    coalesce((payload->'branding'), '{}'::jsonb)
  );

  -- Seed catálogo inicial (por org)
  insert into public.catalog_items(org_id, name, category, requires_description, allows_origin, default_origin)
  values
    (v_org_id, 'Vacina polivalente V8 (importada)', 'vaccine', false, false, null),
    (v_org_id, 'Vacina polivalente V12 (nacional)', 'vaccine', false, false, null),
    (v_org_id, 'Vacina antirrábica (importada)', 'vaccine', false, false, null),
    (v_org_id, 'Vacina antirrábica (nacional)', 'vaccine', false, false, null),
    (v_org_id, 'Vacina tríplice felina V3 (nacional)', 'vaccine', false, false, null),
    (v_org_id, 'Vacina anticion', 'vaccine', false, true, null),
    (v_org_id, 'Medicações', 'medication', true, false, null),
    (v_org_id, 'Outro…', 'other', true, false, null);

  -- Templates padrão WhatsApp
  insert into public.message_templates(org_id, name, channel, body)
  values
    (v_org_id, 'Lembrete - padrão', 'whatsapp',
     'Olá {{tutor_name}}! Aqui é da {{store_name}}. Passando para lembrar da próxima aplicação em {{due_date}}. Se preferir, podemos agendar.');

  return v_org_id;
end;
$$;

create or replace function public.create_appointment_with_items(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_appointment_id uuid;
  v_items jsonb;
  v_item jsonb;
begin
  v_org_id := public.get_my_org_id();
  if v_org_id is null then
    raise exception 'Profile sem org. Faça onboarding.';
  end if;

  v_branch_id := nullif(payload->>'branch_id','')::uuid;

  insert into public.appointments(
    org_id, branch_id, tutor_id,
    scheduled_date, scheduled_time, channel, notes,
    created_by
  )
  values (
    v_org_id,
    v_branch_id,
    (payload->>'tutor_id')::uuid,
    (payload->>'scheduled_date')::date,
    (payload->>'scheduled_time')::time,
    coalesce(payload->>'channel','store'),
    nullif(payload->>'notes',''),
    auth.uid()
  )
  returning id into v_appointment_id;

  v_items := coalesce(payload->'items', '[]'::jsonb);
  if jsonb_array_length(v_items) = 0 then
    raise exception 'É necessário ao menos 1 item.';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    insert into public.appointment_items(
      org_id, appointment_id, catalog_item_id, pet_id,
      quantity, free_description, price_cents, brand, lot, expires_on, metadata
    )
    values (
      v_org_id,
      v_appointment_id,
      (v_item->>'catalog_item_id')::uuid,
      nullif(v_item->>'pet_id','')::uuid,
      greatest((v_item->>'quantity')::int, 1),
      nullif(v_item->>'free_description',''),
      nullif(v_item->>'price_cents','')::int,
      nullif(v_item->>'brand',''),
      nullif(v_item->>'lot',''),
      nullif(v_item->>'expires_on','')::date,
      coalesce(v_item->'metadata','{}'::jsonb)
    );
  end loop;

  return v_appointment_id;
end;
$$;

create or replace function public.checkout_appointment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_checkout_id uuid;
  v_appointment_id uuid;
begin
  v_org_id := public.get_my_org_id();
  if v_org_id is null then
    raise exception 'Profile sem org. Faça onboarding.';
  end if;

  v_appointment_id := (payload->>'appointment_id')::uuid;

  insert into public.appointment_checkouts(
    org_id, appointment_id,
    status_result, checkout_date, notes,
    next_due_date, next_due_pet_id, create_item_reminders,
    created_by
  )
  values (
    v_org_id,
    v_appointment_id,
    (payload->>'status_result')::text,
    (payload->>'checkout_date')::date,
    nullif(payload->>'notes',''),
    nullif(payload->>'next_due_date','')::date,
    nullif(payload->>'next_due_pet_id','')::uuid,
    coalesce((payload->>'create_item_reminders')::boolean, false),
    auth.uid()
  )
  returning id into v_checkout_id;

  return v_checkout_id;
end;
$$;

create or replace function public.merge_tutors(old_id uuid, new_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Somente admin pode fazer merge.';
  end if;

  v_org_id := public.get_my_org_id();

  update public.pets set tutor_id = new_id
  where tutor_id = old_id and org_id = v_org_id;

  update public.appointments set tutor_id = new_id
  where tutor_id = old_id and org_id = v_org_id;

  update public.reminders set tutor_id = new_id
  where tutor_id = old_id and org_id = v_org_id;

  update public.tutors set is_active = false
  where id = old_id and org_id = v_org_id;
end;
$$;

-- =========================
-- Views
-- =========================
create or replace view public.vw_upcoming_appointments
as
select
  a.id,
  a.org_id,
  a.branch_id,
  a.tutor_id,
  a.scheduled_date,
  a.scheduled_time,
  a.channel,
  a.status,
  a.notes,
  t.name as tutor_name,
  t.phone1 as tutor_phone1,
  t.phone2 as tutor_phone2,
  (
    select jsonb_agg(
      jsonb_build_object(
        'quantity', ai.quantity,
        'item', ci.name,
        'pet_id', ai.pet_id
      )
      order by ai.created_at asc
    )
    from public.appointment_items ai
    join public.catalog_items ci on ci.id = ai.catalog_item_id
    where ai.appointment_id = a.id
  ) as items
from public.appointments a
join public.tutors t on t.id = a.tutor_id
where a.status = 'PENDENTE' and a.is_active = true;

create or replace view public.vw_due_reminders
as
select
  r.*,
  t.name as tutor_name,
  t.phone1 as tutor_phone1,
  t.phone2 as tutor_phone2,
  p.name as pet_name
from public.reminders r
join public.tutors t on t.id = r.tutor_id
left join public.pets p on p.id = r.pet_id
where r.status = 'ATIVO' and r.is_active = true;

create or replace view public.vw_dashboard_kpis
as
select
  o.id as org_id,
  (select count(*) from public.appointments a where a.org_id = o.id and a.status = 'PENDENTE' and a.scheduled_date = current_date) as pending_today,
  (select count(*) from public.appointments a where a.org_id = o.id and a.status = 'PENDENTE' and a.scheduled_date between current_date and current_date + 6) as pending_7d,
  (select count(*) from public.appointments a where a.org_id = o.id and a.status = 'APLICADO' and date_trunc('month', a.updated_at) = date_trunc('month', now())) as applied_month,
  (select count(*) from public.appointments a where a.org_id = o.id and a.status = 'CANCELADO' and date_trunc('month', a.updated_at) = date_trunc('month', now())) as cancelled_month,
  (select count(*) from public.reminders r where r.org_id = o.id and r.status = 'ATIVO' and r.due_date < current_date) as overdue_reminders
from public.organizations o;