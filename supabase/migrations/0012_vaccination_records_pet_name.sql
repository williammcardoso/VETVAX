-- VetVAX - include the pet's name in vw_vaccination_records items.
-- Until now items only carried pet_id, so the tutor history timeline
-- couldn't show which pet received which vaccine.

drop view if exists public.vw_vaccination_records;

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
        'pet_name', p.name,
        'brand', vri.brand,
        'lot', vri.lot,
        'expires_on', vri.expires_on
      )
      order by vri.created_at asc
    )
    from public.vaccination_record_items vri
    join public.catalog_items ci on ci.id = vri.catalog_item_id
    left join public.pets p on p.id = vri.pet_id
    where vri.record_id = vr.id
  ) as items
from public.vaccination_records vr
join public.tutors t on t.id = vr.tutor_id
where vr.is_active = true;
