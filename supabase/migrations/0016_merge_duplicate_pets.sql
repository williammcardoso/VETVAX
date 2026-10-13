-- VetVAX - unificar tutores agora também junta os pets repetidos.
--
-- Antes, merge_tutors só movia os pets do tutor antigo para o novo; se os dois cadastros
-- tinham o mesmo animal (ex: "Sheetara Joaquina"), sobravam dois pets iguais no tutor final.
--
-- merge_duplicate_pets(tutor): dentro de um tutor, pets ativos com mesmo nome (ignorando
-- acento, maiúscula e espaços repetidos) e mesma espécie viram um só. Fica o cadastro mais
-- completo (raça, nascimento, cor, idade) e, em empate, o mais antigo. Aplicações, lembretes
-- e demais vínculos dos repetidos passam para o que fica; dados que faltavam no que fica são
-- preenchidos com os do repetido; os repetidos são desativados (não apagados).
--
-- merge_tutors passa a chamar essa função no final.

create or replace function public.merge_duplicate_pets(p_tutor_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_merged int := 0;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Somente admin pode unificar pets.';
  end if;

  v_org_id := public.get_my_org_id();

  if not exists (select 1 from public.tutors where id = p_tutor_id and org_id = v_org_id) then
    raise exception 'Tutor inválido para esta organização.';
  end if;

  for r in
    with base as (
      select
        p.id,
        p.species,
        p.created_at,
        translate(
          lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g')),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ) as nkey,
        (p.breed is not null)::int + (p.birth_date is not null)::int
          + (p.color is not null)::int + (p.age_text is not null)::int as completeness
      from public.pets p
      where p.tutor_id = p_tutor_id and p.org_id = v_org_id and p.is_active = true
    )
    select
      b.id,
      first_value(b.id) over (
        partition by b.species, b.nkey
        order by b.completeness desc, b.created_at asc, b.id
      ) as keeper_id
    from base b
  loop
    if r.id = r.keeper_id then
      continue;
    end if;

    update public.reminders set pet_id = r.keeper_id where pet_id = r.id and org_id = v_org_id;
    update public.vaccination_record_items set pet_id = r.keeper_id where pet_id = r.id and org_id = v_org_id;
    update public.vaccination_records set next_due_pet_id = r.keeper_id where next_due_pet_id = r.id and org_id = v_org_id;
    update public.appointment_items set pet_id = r.keeper_id where pet_id = r.id and org_id = v_org_id;
    update public.appointment_checkouts set next_due_pet_id = r.keeper_id where next_due_pet_id = r.id and org_id = v_org_id;

    update public.pets k
    set breed = coalesce(k.breed, d.breed),
        birth_date = coalesce(k.birth_date, d.birth_date),
        color = coalesce(k.color, d.color),
        age_text = coalesce(k.age_text, d.age_text),
        notes = coalesce(k.notes, d.notes)
    from public.pets d
    where k.id = r.keeper_id and d.id = r.id;

    update public.pets set is_active = false where id = r.id and org_id = v_org_id;

    v_merged := v_merged + 1;
  end loop;

  return v_merged;
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

  update public.vaccination_records set tutor_id = new_id
  where tutor_id = old_id and org_id = v_org_id;

  update public.reminders set tutor_id = new_id
  where tutor_id = old_id and org_id = v_org_id;

  update public.tutors set is_active = false
  where id = old_id and org_id = v_org_id;

  perform public.merge_duplicate_pets(new_id);
end;
$$;
