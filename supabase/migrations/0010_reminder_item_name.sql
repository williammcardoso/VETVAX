-- VetVAX - store the specific item/vaccine name on each reminder.
-- Until now reminders only carried a generic category ("vacina"/"medicação"),
-- so cards showed "vacina" instead of e.g. "V12 - NACIONAL". Add a proper
-- item_name column, backfill the legacy rows (imported from the old system,
-- where the name is buried in notes as "TipoVacAg=<name> ..."), and have
-- register_vaccination populate it going forward.

alter table public.reminders add column if not exists item_name text;

update public.reminders
set item_name = nullif(trim(substring(notes from 'TipoVacAg=(.+?)(?:\s+OkAg=|\s+ObsAg=|$)')), 'null')
where item_name is null
  and notes ~ 'TipoVacAg=';

drop view if exists public.vw_due_reminders;

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
  v_next_due_date date;
  v_next_due_pet_id uuid;
  v_create_item_reminders boolean;
  v_reference_reminder_id uuid;
  v_reminder_item record;
  v_reminder_type text;
  v_any_category text;
  v_any_item_name text;
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
    v_org_id, v_branch_id, v_tutor_id, v_applied_date, v_notes,
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
        select vri.pet_id, ci.category, ci.name
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
          reminder_type, item_name, status, notes
        )
        values(
          v_org_id, v_branch_id, v_tutor_id,
          coalesce(v_next_due_pet_id, v_reminder_item.pet_id),
          v_next_due_date,
          v_record_id,
          v_applied_date,
          v_reminder_type,
          v_reminder_item.name,
          'ATIVO',
          v_notes
        );
      end loop;
    else
      select ci.category, ci.name into v_any_category, v_any_item_name
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
        reminder_type, item_name, status, notes
      )
      values(
        v_org_id, v_branch_id, v_tutor_id,
        v_next_due_pet_id,
        v_next_due_date,
        v_record_id,
        v_applied_date,
        coalesce(v_reminder_type, 'vacina'),
        v_any_item_name,
        'ATIVO',
        v_notes
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
