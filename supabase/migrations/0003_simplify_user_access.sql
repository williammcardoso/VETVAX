-- VetVAX - simplified user access
-- Keep org isolation, but remove role-based restrictions from the app workflow.

update public.profiles
set role = 'admin'
where role <> 'admin';

drop index if exists public.uniq_tutors_org_phone1;

-- Profiles: every member can list and update users from the same organization.
drop policy if exists profiles_select_org_admin on public.profiles;
drop policy if exists profiles_update_org_admin on public.profiles;
drop policy if exists profiles_select_org_members on public.profiles;
drop policy if exists profiles_update_org_members on public.profiles;

create policy profiles_select_org_members on public.profiles
for select
using (org_id = public.get_my_org_id());

create policy profiles_update_org_members on public.profiles
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Branches
drop policy if exists branches_write on public.branches;
drop policy if exists branches_update on public.branches;
drop policy if exists branches_delete on public.branches;

create policy branches_write on public.branches
for insert
with check (org_id = public.get_my_org_id());

create policy branches_update on public.branches
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

create policy branches_delete on public.branches
for delete
using (org_id = public.get_my_org_id());

-- Organization settings
drop policy if exists org_settings_write on public.org_settings;
drop policy if exists org_settings_update on public.org_settings;

create policy org_settings_write on public.org_settings
for insert
with check (org_id = public.get_my_org_id());

create policy org_settings_update on public.org_settings
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Message templates
drop policy if exists templates_write on public.message_templates;
drop policy if exists templates_update on public.message_templates;

create policy templates_write on public.message_templates
for insert
with check (org_id = public.get_my_org_id());

create policy templates_update on public.message_templates
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Tutors
drop policy if exists tutors_write on public.tutors;
drop policy if exists tutors_update on public.tutors;

create policy tutors_write on public.tutors
for insert
with check (org_id = public.get_my_org_id());

create policy tutors_update on public.tutors
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Pets
drop policy if exists pets_write on public.pets;
drop policy if exists pets_update on public.pets;

create policy pets_write on public.pets
for insert
with check (org_id = public.get_my_org_id());

create policy pets_update on public.pets
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Catalog
drop policy if exists catalog_write on public.catalog_items;
drop policy if exists catalog_update on public.catalog_items;

create policy catalog_write on public.catalog_items
for insert
with check (org_id = public.get_my_org_id());

create policy catalog_update on public.catalog_items
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Appointments
drop policy if exists appointments_write on public.appointments;
drop policy if exists appointments_update on public.appointments;

create policy appointments_write on public.appointments
for insert
with check (org_id = public.get_my_org_id());

create policy appointments_update on public.appointments
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Appointment items
drop policy if exists appointment_items_write on public.appointment_items;
drop policy if exists appointment_items_update on public.appointment_items;

create policy appointment_items_write on public.appointment_items
for insert
with check (org_id = public.get_my_org_id());

create policy appointment_items_update on public.appointment_items
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Checkouts
drop policy if exists checkouts_write on public.appointment_checkouts;
drop policy if exists checkouts_update on public.appointment_checkouts;
drop policy if exists checkouts_delete on public.appointment_checkouts;

create policy checkouts_write on public.appointment_checkouts
for insert
with check (org_id = public.get_my_org_id());

create policy checkouts_update on public.appointment_checkouts
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

create policy checkouts_delete on public.appointment_checkouts
for delete
using (org_id = public.get_my_org_id());

-- Reminders
drop policy if exists reminders_write on public.reminders;
drop policy if exists reminders_update on public.reminders;

create policy reminders_write on public.reminders
for insert
with check (org_id = public.get_my_org_id());

create policy reminders_update on public.reminders
for update
using (org_id = public.get_my_org_id())
with check (org_id = public.get_my_org_id());

-- Outbox, export jobs and audit logs follow the same org-only rule.
drop policy if exists outbox_select on public.message_outbox;
drop policy if exists outbox_write on public.message_outbox;

create policy outbox_select on public.message_outbox
for select
using (org_id = public.get_my_org_id());

create policy outbox_write on public.message_outbox
for insert
with check (org_id = public.get_my_org_id());

drop policy if exists export_jobs_write on public.export_jobs;

create policy export_jobs_write on public.export_jobs
for insert
with check (org_id = public.get_my_org_id());

drop policy if exists audit_select on public.audit_log;

create policy audit_select on public.audit_log
for select
using (org_id = public.get_my_org_id());
