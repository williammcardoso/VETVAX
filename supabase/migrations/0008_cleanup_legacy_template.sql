-- VetVAX - remove the leftover "Agendamento - padrão" WhatsApp template.
-- It was used by the old scheduling flow (confirming a booked appointment)
-- which no longer exists; nothing in the app references this template by
-- name anymore, so it's just dead data.

drop policy if exists templates_delete on public.message_templates;
create policy templates_delete on public.message_templates
for delete
using (org_id = public.get_my_org_id() and public.is_manager_or_admin());

delete from public.message_templates
where name = 'Agendamento - padrão' and channel = 'whatsapp';
