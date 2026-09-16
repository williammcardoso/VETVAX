-- VetVAX - split the WhatsApp reminder message into two templates:
-- "Lembrete - padrão" (used for upcoming/not-yet-due reminders, kept as-is
-- so any customization already made survives) and a new
-- "Lembrete - vencida" for overdue ones, so staff can use more urgent
-- wording for clients who are already late.

insert into public.message_templates (org_id, name, channel, body)
select o.id, 'Lembrete - vencida', 'whatsapp',
  '⚠️ Olá, {{tutor_name}}! Aqui é da {{store_name}}.' || chr(10) ||
  'A vacina de {{pet_name}} está *atrasada* desde {{due_date}}. Vacina em atraso deixa o pet mais exposto a doenças sérias, e alguns protocolos precisam reiniciar a série se o atraso for grande. 🐾💉' || chr(10) ||
  'Pra resolver rápido, responda aqui com o melhor dia *esta semana* que já deixamos reservado pra você.'
from public.organizations o
where not exists (
  select 1 from public.message_templates mt
  where mt.org_id = o.id and mt.channel = 'whatsapp' and mt.name = 'Lembrete - vencida'
);

-- Seed both templates for orgs created from now on.
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
     '🐾 Olá, {{tutor_name}}! Aqui é da {{store_name}}.' || chr(10) ||
     'Passando para lembrar que a vacina de {{pet_name}} está prevista para {{due_date}}. Quer já deixar agendado? Responda aqui com o melhor dia! 📅'),
    (v_org_id, 'Lembrete - vencida', 'whatsapp',
     '⚠️ Olá, {{tutor_name}}! Aqui é da {{store_name}}.' || chr(10) ||
     'A vacina de {{pet_name}} está *atrasada* desde {{due_date}}. Vacina em atraso deixa o pet mais exposto a doenças sérias, e alguns protocolos precisam reiniciar a série se o atraso for grande. 🐾💉' || chr(10) ||
     'Pra resolver rápido, responda aqui com o melhor dia *esta semana* que já deixamos reservado pra você.');

  return v_org_id;
end;
$$;
