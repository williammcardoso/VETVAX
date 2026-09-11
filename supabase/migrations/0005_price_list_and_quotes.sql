-- VetVAX - price list and quote templates

create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vaccine_name text not null,
  price_cents int not null check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_price_list_items_org on public.price_list_items(org_id);
create index if not exists idx_price_list_items_org_active on public.price_list_items(org_id, is_active);

drop trigger if exists trg_price_list_items_updated_at on public.price_list_items;
create trigger trg_price_list_items_updated_at
before update on public.price_list_items
for each row execute function public.set_updated_at();

create table if not exists public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_templates_org on public.quote_templates(org_id);
create index if not exists idx_quote_templates_org_active on public.quote_templates(org_id, is_active);

drop trigger if exists trg_quote_templates_updated_at on public.quote_templates;
create trigger trg_quote_templates_updated_at
before update on public.quote_templates
for each row execute function public.set_updated_at();

create table if not exists public.quote_template_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quote_template_id uuid not null references public.quote_templates(id) on delete cascade,
  price_list_item_id uuid not null references public.price_list_items(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_template_items_org on public.quote_template_items(org_id);
create index if not exists idx_quote_template_items_quote on public.quote_template_items(quote_template_id);

drop trigger if exists trg_quote_template_items_updated_at on public.quote_template_items;
create trigger trg_quote_template_items_updated_at
before update on public.quote_template_items
for each row execute function public.set_updated_at();

alter table public.price_list_items enable row level security;
alter table public.quote_templates enable row level security;
alter table public.quote_template_items enable row level security;

drop policy if exists price_list_select on public.price_list_items;
create policy price_list_select on public.price_list_items
for select
using (org_id = public.get_my_org_id());

drop policy if exists price_list_write on public.price_list_items;
create policy price_list_write on public.price_list_items
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists price_list_update on public.price_list_items;
create policy price_list_update on public.price_list_items
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists quote_templates_select on public.quote_templates;
create policy quote_templates_select on public.quote_templates
for select
using (org_id = public.get_my_org_id());

drop policy if exists quote_templates_write on public.quote_templates;
create policy quote_templates_write on public.quote_templates
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists quote_templates_update on public.quote_templates;
create policy quote_templates_update on public.quote_templates
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists quote_items_select on public.quote_template_items;
create policy quote_items_select on public.quote_template_items
for select
using (org_id = public.get_my_org_id());

drop policy if exists quote_items_write on public.quote_template_items;
create policy quote_items_write on public.quote_template_items
for insert
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists quote_items_update on public.quote_template_items;
create policy quote_items_update on public.quote_template_items
for update
using (org_id = public.get_my_org_id() and public.is_staff_or_higher())
with check (org_id = public.get_my_org_id() and public.is_staff_or_higher());

drop policy if exists quote_items_delete on public.quote_template_items;
create policy quote_items_delete on public.quote_template_items
for delete
using (org_id = public.get_my_org_id() and public.is_staff_or_higher());
