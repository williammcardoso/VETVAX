-- VetVAX - surface still-open legacy appointments as reminders.
-- These PENDENTE appointments (no checkout) are real due vaccinations
-- carried over from the previous system — the new app has no concept of a
-- "pending appointment" anymore, so without this backfill they are
-- invisible to Dashboard/Reminders. One reminder per item, so multi-item
-- appointments aren't collapsed into a single vague entry.
--
-- Idempotent: an appointment already linked to a reminder (reference_appointment_id)
-- is skipped entirely on re-run.

insert into public.reminders (
  org_id, branch_id, tutor_id, pet_id, due_date,
  reference_appointment_id, reminder_type, status, notes
)
select
  a.org_id, a.branch_id, a.tutor_id, ai.pet_id, a.scheduled_date,
  a.id,
  case ci.category
    when 'vaccine' then 'vacina'
    when 'medication' then 'medicação'
    else 'outro'
  end,
  'ATIVO',
  a.notes
from public.appointments a
join public.appointment_items ai on ai.appointment_id = a.id
join public.catalog_items ci on ci.id = ai.catalog_item_id
where a.status = 'PENDENTE'
  and a.is_active = true
  and not exists (
    select 1 from public.appointment_checkouts ac where ac.appointment_id = a.id
  )
  and not exists (
    select 1 from public.reminders r where r.reference_appointment_id = a.id
  );
