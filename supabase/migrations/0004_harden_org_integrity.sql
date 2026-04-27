-- VetVAX - harden org integrity for security-definer RPCs
-- Keep the simple single-clinic UX, but prevent cross-org references.

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
  select org_id into v_org_id
  from public.profiles
  where id = auth.uid();

  if v_org_id is not null then
    return v_org_id;
  end if;

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
  v_tutor_id uuid;
  v_catalog_item_id uuid;
  v_pet_id uuid;
  v_appointment_id uuid;
  v_items jsonb;
  v_item jsonb;
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

  insert into public.appointments(
    org_id, branch_id, tutor_id,
    scheduled_date, scheduled_time, channel, notes,
    created_by
  )
  values (
    v_org_id,
    v_branch_id,
    v_tutor_id,
    (payload->>'scheduled_date')::date,
    (payload->>'scheduled_time')::time,
    coalesce(payload->>'channel','store'),
    nullif(payload->>'notes',''),
    auth.uid()
  )
  returning id into v_appointment_id;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_catalog_item_id := (v_item->>'catalog_item_id')::uuid;
    v_pet_id := nullif(v_item->>'pet_id','')::uuid;

    if not exists (select 1 from public.catalog_items where id = v_catalog_item_id and org_id = v_org_id and is_active = true) then
      raise exception 'Item inválido para esta organização.';
    end if;

    if v_pet_id is not null and not exists (
      select 1 from public.pets
      where id = v_pet_id
        and tutor_id = v_tutor_id
        and org_id = v_org_id
        and is_active = true
    ) then
      raise exception 'Pet inválido para este tutor.';
    end if;

    insert into public.appointment_items(
      org_id, appointment_id, catalog_item_id, pet_id,
      quantity, free_description, price_cents, brand, lot, expires_on, metadata
    )
    values (
      v_org_id,
      v_appointment_id,
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
  v_next_due_pet_id uuid;
begin
  v_org_id := public.get_my_org_id();
  if v_org_id is null then
    raise exception 'Profile sem org. Faça onboarding.';
  end if;

  v_appointment_id := (payload->>'appointment_id')::uuid;
  if not exists (select 1 from public.appointments where id = v_appointment_id and org_id = v_org_id) then
    raise exception 'Agendamento inválido para esta organização.';
  end if;

  v_next_due_pet_id := nullif(payload->>'next_due_pet_id','')::uuid;
  if v_next_due_pet_id is not null and not exists (
    select 1
    from public.pets p
    join public.appointments a on a.tutor_id = p.tutor_id
    where p.id = v_next_due_pet_id
      and a.id = v_appointment_id
      and p.org_id = v_org_id
  ) then
    raise exception 'Pet do próximo lembrete inválido para este agendamento.';
  end if;

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
    v_next_due_pet_id,
    coalesce((payload->>'create_item_reminders')::boolean, false),
    auth.uid()
  )
  returning id into v_checkout_id;

  return v_checkout_id;
end;
$$;
