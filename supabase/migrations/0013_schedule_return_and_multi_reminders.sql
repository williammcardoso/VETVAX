-- VetVAX - two fixes to the reminder/return workflow:
--
-- 1. "Agendar retorno": until now the only way to note a future visit was
--    register_vaccination, which always creates a vaccination_records row —
--    i.e. treats it as an already-applied fact. Staff had no way to say
--    "client will come on day X" without either lying about an application
--    happening today, or applying it twice later (duplicate/incorrect data).
--    schedule_reminders() creates reminder(s) directly, with no application
--    attached — exactly "book a return" without pretending it happened.
--
-- 2. register_vaccination's next-due handling used to be a single date +
--    a "one reminder per item" toggle, which can't express "return in 15
--    days for a *different* vaccine, and in 1 year for the *same* one".
--    Replaced with a `next_reminders` array: each entry picks its own
--    vaccine, date and (optionally) pet.

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
  v_notes text;
  v_reference_reminder_id uuid;
  v_next_reminders jsonb;
  v_next jsonb;
  v_next_catalog_item_id uuid;
  v_next_pet_id uuid;
  v_next_due_date date;
  v_item_name text;
  v_category text;
  v_reminder_type text;
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
  v_notes := nullif(payload->>'notes','');
  v_reference_reminder_id := nullif(payload->>'reference_reminder_id','')::uuid;

  if v_reference_reminder_id is not null and not exists (
    select 1 from public.reminders where id = v_reference_reminder_id and org_id = v_org_id and tutor_id = v_tutor_id
  ) then
    raise exception 'Lembrete inválido para este tutor.';
  end if;

  insert into public.vaccination_records(
    org_id, branch_id, tutor_id, applied_date, notes,
    reference_reminder_id, created_by
  )
  values (
    v_org_id, v_branch_id, v_tutor_id, v_applied_date, v_notes,
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

  v_next_reminders := coalesce(payload->'next_reminders', '[]'::jsonb);
  for v_next in select * from jsonb_array_elements(v_next_reminders)
  loop
    v_next_due_date := nullif(v_next->>'due_date','')::date;
    if v_next_due_date is null then
      continue;
    end if;

    v_next_catalog_item_id := (v_next->>'catalog_item_id')::uuid;
    v_next_pet_id := nullif(v_next->>'pet_id','')::uuid;

    select ci.name, ci.category into v_item_name, v_category
    from public.catalog_items ci
    where ci.id = v_next_catalog_item_id and ci.org_id = v_org_id and ci.is_active = true;

    if v_item_name is null then
      raise exception 'Vacina do retorno inválida para esta organização.';
    end if;

    if v_next_pet_id is not null and not exists (
      select 1 from public.pets
      where id = v_next_pet_id and tutor_id = v_tutor_id and org_id = v_org_id and is_active = true
    ) then
      raise exception 'Pet do retorno inválido para este tutor.';
    end if;

    v_reminder_type := case v_category
      when 'vaccine' then 'vacina'
      when 'medication' then 'medicação'
      else 'outro'
    end;

    insert into public.reminders(
      org_id, branch_id, tutor_id, pet_id, due_date,
      reference_record_id, last_applied_at,
      reminder_type, item_name, status, notes
    )
    values (
      v_org_id, v_branch_id, v_tutor_id, v_next_pet_id, v_next_due_date,
      v_record_id, v_applied_date,
      v_reminder_type, v_item_name, 'ATIVO', null
    );
  end loop;

  update public.vaccination_records
    set next_due_date = (select min(due_date) from public.reminders where reference_record_id = v_record_id)
  where id = v_record_id;

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
-- RPC: schedule_reminders
-- Books one or more future returns for a tutor without registering an
-- application. Each entry becomes its own ATIVO reminder.
-- =========================
create or replace function public.schedule_reminders(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_branch_id uuid;
  v_tutor_id uuid;
  v_reminders jsonb;
  v_r jsonb;
  v_catalog_item_id uuid;
  v_pet_id uuid;
  v_due_date date;
  v_notes text;
  v_item_name text;
  v_category text;
  v_reminder_type text;
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

  v_reminders := coalesce(payload->'reminders', '[]'::jsonb);
  if jsonb_array_length(v_reminders) = 0 then
    raise exception 'Informe ao menos um retorno para agendar.';
  end if;

  for v_r in select * from jsonb_array_elements(v_reminders)
  loop
    v_due_date := nullif(v_r->>'due_date','')::date;
    if v_due_date is null then
      raise exception 'Informe a data do retorno.';
    end if;

    v_catalog_item_id := (v_r->>'catalog_item_id')::uuid;
    v_pet_id := nullif(v_r->>'pet_id','')::uuid;
    v_notes := nullif(v_r->>'notes','');

    select ci.name, ci.category into v_item_name, v_category
    from public.catalog_items ci
    where ci.id = v_catalog_item_id and ci.org_id = v_org_id and ci.is_active = true;

    if v_item_name is null then
      raise exception 'Vacina inválida para esta organização.';
    end if;

    if v_pet_id is not null and not exists (
      select 1 from public.pets
      where id = v_pet_id and tutor_id = v_tutor_id and org_id = v_org_id and is_active = true
    ) then
      raise exception 'Pet inválido para este tutor.';
    end if;

    v_reminder_type := case v_category
      when 'vaccine' then 'vacina'
      when 'medication' then 'medicação'
      else 'outro'
    end;

    insert into public.reminders(
      org_id, branch_id, tutor_id, pet_id, due_date,
      reminder_type, item_name, status, notes
    )
    values (
      v_org_id, v_branch_id, v_tutor_id, v_pet_id, v_due_date,
      v_reminder_type, v_item_name, 'ATIVO', v_notes
    );
  end loop;
end;
$$;
