-- VetVAX - invites accept flow + admin user management

-- =========================
-- Invites: unique token
-- =========================
create unique index if not exists uniq_invites_token on public.invites(token);

-- =========================
-- Profiles: allow admin to list/update org members
-- =========================
-- Existing policies are created in 0001. Here we extend them safely.

drop policy if exists profiles_select_org_admin on public.profiles;
create policy profiles_select_org_admin on public.profiles
for select
using (
  public.is_admin() and org_id = public.get_my_org_id()
);

drop policy if exists profiles_update_org_admin on public.profiles;
create policy profiles_update_org_admin on public.profiles
for update
using (
  public.is_admin() and org_id = public.get_my_org_id()
)
with check (
  public.is_admin() and org_id = public.get_my_org_id()
);

-- =========================
-- RPC: accept_invite(token)
-- =========================
create or replace function public.accept_invite(token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invites%rowtype;
  v_email text;
  v_current_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Precisa estar autenticado(a) para aceitar convite.';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Não foi possível ler seu email do token JWT.';
  end if;

  select * into v_inv
  from public.invites i
  where i.token = accept_invite.token
    and i.is_active = true
    and i.accepted_at is null
    and i.expires_at > now()
  limit 1;

  if not found then
    raise exception 'Convite inválido, expirado ou já aceito.';
  end if;

  if lower(v_inv.email) <> v_email then
    raise exception 'Este convite é para outro email.';
  end if;

  select org_id into v_current_org from public.profiles where id = auth.uid();
  if v_current_org is not null and v_current_org <> v_inv.org_id then
    raise exception 'Seu usuário já pertence a outra organização.';
  end if;

  update public.profiles
    set org_id = v_inv.org_id,
        branch_id = v_inv.branch_id,
        role = v_inv.role,
        updated_at = now()
  where id = auth.uid();

  update public.invites
    set accepted_at = now(),
        is_active = false,
        updated_at = now()
  where id = v_inv.id;

  return v_inv.org_id;
end;
$$;
