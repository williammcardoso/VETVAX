-- VetVAX - replace scheduled appointments with direct vaccination records
-- The old flow required creating a future "appointment" (date/time), then a
-- separate checkout to mark it applied, then duplicating it to "reschedule".
-- This migration collapses that into a single act: registering a vaccination
-- record the moment it happens (or already happened), with an optional next
-- due date that spawns a reminder automatically.
--
-- appointments / appointment_items / appointment_checkouts are kept as-is
-- (untouched) for historical audit. Nothing new writes to them.

-- =========================
-- New tables
-- =========================
create table if not exists public.vaccination_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  tutor_id uuid not null references public.tutors(id) on delete restrict,

  applied_date date not null default current_date,
  notes text,

  next_due_date date,
  next_due_pet_id uuid references public.pets(id) on delete set null,
  create_item_reminders boolean not null default false,

  reference_reminder_id uuid references public.reminders(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_vaccination_records_org_date on public.vaccination_records(org_id, applied_date);
create index if not exists idx_vaccination_records_tutor on public.vaccination_records(tutor_id);

drop trigger if exists trg_vaccination_records_updated_at on public.vaccination_records;
create trigger trg_vaccination_records_updated_at
before update on public.vaccination_records
for each row execute function public.set_updated_at();

create table if not exists public.vaccination_record_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  record_id uuid not null references public.vaccination_records(id) on delete cascade,
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

create index if not exists idx_vaccination_record_items_org on public.vaccination_record_items(org_id);
create index if not exists idx_vaccination_record_items_record on public.vaccination_record_items(record_id);

drop trigger if exists trg_vaccination_record_items_updated_at on public.vaccination_record_items;
create trigger trg_vaccination_record_items_updated_at
before update on public.vaccination_record_items
for each row execute function public.set_updated_at();

-- link reminders back to the record that resolved/created them
alter table public.reminders add column if not exists reference_record_id uuid references public.vaccination_records(id) on delete set null;

-- =========================
-- RLS
-- =========================
alter table public.vaccination_records enable row level security;
alter table public.vaccination_record_items enable row level security;

drop policy if exists vaccination_records_select on public.vaccination_records;
create policy vaccination_records_select on public.vaccination_records
for select
using (org_id = public.get_my_org_id());

drop policy if exists vaccination_records_write on public.vaccination_records;
create policy vaccination_records_write on public.vaccination_records
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists vaccination_records_update on public.vaccination_records;
create policy vaccination_records_update on public.vaccination_records
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists vaccination_record_items_select on public.vaccination_record_items;
create policy vaccination_record_items_select on public.vaccination_record_items
for select
using (org_id = public.get_my_org_id());

drop policy if exists vaccination_record_items_write on public.vaccination_record_items;
create policy vaccination_record_items_write on public.vaccination_record_items
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop trigger if exists trg_audit_vaccination_records on public.vaccination_records;
create trigger trg_audit_vaccination_records
after insert or update or delete on public.vaccination_records
for each row execute function public.audit_changes();

-- =========================
-- RPC: register_vaccination
-- Single call that replaces create_appointment_with_items + checkout_appointment.
-- =========================
create or replace function public.register_vaccination(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_tutor_id uuid;
  v_record_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_catalog_item_id uuid;
  v_pet_id uuid;
  v_applied_date date;
  v_next_due_date date;
  v_next_due_pet_id uuid;
  v_create_item_reminders boolean;
  v_reference_reminder_id uuid;
  v_reminder_item record;
  v_reminder_type text;
  v_any_category text;
begin
  v_org_id := public.get_my_org_id();
  if v_org_id is null then
    raise exception 'Profile sem org. Faça onboarding.';
  end if;

  v_tutor_id := (payload->>'tutor_id')::uuid;
  if not exists (select 1 from public.tutors where id = v_tutor_id and org_id = v_org_id and is_active = true) then
    raise exception 'Tutor inválido para esta organização.';
  end if;

  v_branch_id := nullif(payload->>'branch_id','')::uuid;
  if v_branch_id is not null and not exists (select 1 from public.branches where id = v_branch_id and org_id = v_org_id) then
    raise exception 'Filial inválida para esta organização.';
  end if;

  v_items := coalesce(payload->'items', '[]'::jsonb);
  if jsonb_array_length(v_items) = 0 then
    raise exception 'É necessário ao menos 1 item.';
  end if;

  v_applied_date := coalesce(nullif(payload->>'applied_date','')::date, current_date);
  v_next_due_date := nullif(payload->>'next_due_date','')::date;
  v_next_due_pet_id := nullif(payload->>'next_due_pet_id','')::uuid;
  v_create_item_reminders := coalesce((payload->>'create_item_reminders')::boolean, false);
  v_reference_reminder_id := nullif(payload->>'reference_reminder_id','')::uuid;

  if v_next_due_pet_id is not null and not exists (
    select 1 from public.pets
    where id = v_next_due_pet_id and tutor_id = v_tutor_id and org_id = v_org_id and is_active = true
  ) then
    raise exception 'Pet do próximo lembrete inválido para este tutor.';
  end if;

  if v_reference_reminder_id is not null and not exists (
    select 1 from public.reminders where id = v_reference_reminder_id and org_id = v_org_id and tutor_id = v_tutor_id
  ) then
    raise exception 'Lembrete inválido para este tutor.';
  end if;

  insert into public.vaccination_records(
    org_id, branch_id, tutor_id, applied_date, notes,
    next_due_date, next_due_pet_id, create_item_reminders,
    reference_reminder_id, created_by
  )
  values (
    v_org_id, v_branch_id, v_tutor_id, v_applied_date, nullif(payload->>'notes',''),
    v_next_due_date, v_next_due_pet_id, v_create_item_reminders,
    v_reference_reminder_id, auth.uid()
  )
  returning id into v_record_id;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_catalog_item_id := (v_item->>'catalog_item_id')::uuid;
    v_pet_id := nullif(v_item->>'pet_id','')::uuid;

    if not exists (select 1 from public.catalog_items where id = v_catalog_item_id and org_id = v_org_id and is_active = true) then
      raise exception 'Item inválido para esta organização.';
    end if;

    if v_pet_id is not null and not exists (
      select 1 from public.pets
      where id = v_pet_id and tutor_id = v_tutor_id and org_id = v_org_id and is_active = true
    ) then
      raise exception 'Pet inválido para este tutor.';
    end if;

    insert into public.vaccination_record_items(
      org_id, record_id, catalog_item_id, pet_id,
      quantity, free_description, price_cents, brand, lot, expires_on, metadata
    )
    values (
      v_org_id,
      v_record_id,
      v_catalog_item_id,
      v_pet_id,
      greatest((v_item->>'quantity')::int, 1),
      nullif(v_item->>'free_description',''),
      nullif(v_item->>'price_cents','')::int,
      nullif(v_item->>'brand',''),
      nullif(v_item->>'lot',''),
      nullif(v_item->>'expires_on','')::date,
      coalesce(v_item->'metadata','{}'::jsonb)
    );
  end loop;

  if v_next_due_date is not null then
    if v_create_item_reminders then
      for v_reminder_item in
        select vri.pet_id, ci.category
        from public.vaccination_record_items vri
        join public.catalog_items ci on ci.id = vri.catalog_item_id
        where vri.record_id = v_record_id
      loop
        v_reminder_type := case v_reminder_item.category
          when 'vaccine' then 'vacina'
          when 'medication' then 'medicação'
          else 'outro'
        end;

        insert into public.reminders(
          org_id, branch_id, tutor_id, pet_id, due_date,
          reference_record_id, last_applied_at,
          reminder_type, status, notes
        )
        values(
          v_org_id, v_branch_id, v_tutor_id,
          coalesce(v_next_due_pet_id, v_reminder_item.pet_id),
          v_next_due_date,
          v_record_id,
          v_applied_date,
          v_reminder_type,
          'ATIVO',
          null
        );
      end loop;
    else
      select ci.category into v_any_category
      from public.vaccination_record_items vri
      join public.catalog_items ci on ci.id = vri.catalog_item_id
      where vri.record_id = v_record_id
      order by vri.created_at asc
      limit 1;

      v_reminder_type := case v_any_category
        when 'vaccine' then 'vacina'
        when 'medication' then 'medicação'
        else 'outro'
      end;

      insert into public.reminders(
        org_id, branch_id, tutor_id, pet_id, due_date,
        reference_record_id, last_applied_at,
        reminder_type, status, notes
      )
      values(
        v_org_id, v_branch_id, v_tutor_id,
        v_next_due_pet_id,
        v_next_due_date,
        v_record_id,
        v_applied_date,
        coalesce(v_reminder_type, 'vacina'),
        'ATIVO',
        null
      );
    end if;
  end if;

  if v_reference_reminder_id is not null then
    update public.reminders
      set status = 'FEITO',
          last_applied_at = v_applied_date,
          updated_at = now()
    where id = v_reference_reminder_id and org_id = v_org_id;
  end if;

  return v_record_id;
end;
$$;

-- =========================
-- merge_tutors: also reassign vaccination_records
-- =========================
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

  update public.vaccination_records set tutor_id = new_id
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
drop view if exists public.vw_upcoming_appointments;

create or replace view public.vw_vaccination_records
as
select
  vr.id,
  vr.org_id,
  vr.branch_id,
  vr.tutor_id,
  vr.applied_date,
  vr.next_due_date,
  vr.notes,
  vr.created_by,
  vr.created_at,
  t.name as tutor_name,
  t.phone1 as tutor_phone1,
  t.phone2 as tutor_phone2,
  (
    select jsonb_agg(
      jsonb_build_object(
        'quantity', vri.quantity,
        'item', ci.name,
        'category', ci.category,
        'pet_id', vri.pet_id,
        'brand', vri.brand,
        'lot', vri.lot,
        'expires_on', vri.expires_on
      )
      order by vri.created_at asc
    )
    from public.vaccination_record_items vri
    join public.catalog_items ci on ci.id = vri.catalog_item_id
    where vri.record_id = vr.id
  ) as items
from public.vaccination_records vr
join public.tutors t on t.id = vr.tutor_id
where vr.is_active = true;

drop view if exists public.vw_dashboard_kpis;

create or replace view public.vw_dashboard_kpis
as
select
  o.id as org_id,
  (select count(*) from public.vaccination_records vr where vr.org_id = o.id and vr.is_active = true and vr.applied_date = current_date) as applied_today,
  (select count(*) from public.vaccination_records vr where vr.org_id = o.id and vr.is_active = true and vr.applied_date between current_date - 6 and current_date) as applied_7d,
  (select count(*) from public.vaccination_records vr where vr.org_id = o.id and vr.is_active = true and date_trunc('month', vr.applied_date) = date_trunc('month', now())) as applied_month,
  (select count(*) from public.reminders r where r.org_id = o.id and r.status = 'ATIVO' and r.is_active = true) as active_reminders,
  (select count(*) from public.reminders r where r.org_id = o.id and r.status = 'ATIVO' and r.is_active = true and r.due_date < current_date) as overdue_reminders
from public.organizations o;

-- =========================
-- Backfill: turn historical *applied* appointments into vaccination_records
-- so Reports/Histórico keep showing past data. Pending/cancelled appointments
-- have no equivalent in the new model and are intentionally left behind
-- (still visible in the old tables for audit).
-- =========================
drop table if exists pg_temp._vr_migration_map;

create temporary table _vr_migration_map (
  appointment_id uuid primary key,
  record_id uuid not null
) on commit drop;

insert into _vr_migration_map (appointment_id, record_id)
select a.id, gen_random_uuid()
from public.appointments a
join public.appointment_checkouts ac on ac.appointment_id = a.id
where ac.status_result = 'APLICADO'
  and not exists (
    select 1 from public.vaccination_records vr
    where vr.tutor_id = a.tutor_id and vr.applied_date = ac.checkout_date and vr.created_at = ac.created_at
  );

insert into public.vaccination_records (
  id, org_id, branch_id, tutor_id, applied_date, notes,
  next_due_date, next_due_pet_id, create_item_reminders,
  created_by, created_at, updated_at, is_active
)
select
  m.record_id, a.org_id, a.branch_id, a.tutor_id, ac.checkout_date, ac.notes,
  ac.next_due_date, ac.next_due_pet_id, ac.create_item_reminders,
  ac.created_by, ac.created_at, ac.updated_at, true
from _vr_migration_map m
join public.appointments a on a.id = m.appointment_id
join public.appointment_checkouts ac on ac.appointment_id = a.id;

insert into public.vaccination_record_items (
  org_id, record_id, catalog_item_id, pet_id, quantity, free_description,
  price_cents, brand, lot, expires_on, metadata, created_at, updated_at
)
select
  ai.org_id, m.record_id, ai.catalog_item_id, ai.pet_id, ai.quantity, ai.free_description,
  ai.price_cents, ai.brand, ai.lot, ai.expires_on, ai.metadata, ai.created_at, ai.updated_at
from public.appointment_items ai
join _vr_migration_map m on m.appointment_id = ai.appointment_id;

update public.reminders r
set reference_record_id = m.record_id
from _vr_migration_map m
where r.reference_appointment_id = m.appointment_id;
