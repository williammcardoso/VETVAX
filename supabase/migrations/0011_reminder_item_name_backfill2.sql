-- VetVAX - second-pass backfill for reminders.item_name.
-- 0010 only recovered names embedded in notes ("TipoVacAg=..."). This pass
-- covers reminders whose notes don't have that marker but that do point to
-- a real appointment (legacy) or vaccination_record (created before 0010's
-- register_vaccination started saving item_name) — pull the name from the
-- actual linked item instead of guessing from text.

update public.reminders r
set item_name = sub.item_name
from (
  select distinct on (ai.appointment_id) ai.appointment_id, ci.name as item_name
  from public.appointment_items ai
  join public.catalog_items ci on ci.id = ai.catalog_item_id
  order by ai.appointment_id, ai.created_at asc
) sub
where r.item_name is null
  and r.reference_appointment_id = sub.appointment_id;

update public.reminders r
set item_name = sub.item_name
from (
  select distinct on (vri.record_id) vri.record_id, ci.name as item_name
  from public.vaccination_record_items vri
  join public.catalog_items ci on ci.id = vri.catalog_item_id
  order by vri.record_id, vri.created_at asc
) sub
where r.item_name is null
  and r.reference_record_id = sub.record_id;
