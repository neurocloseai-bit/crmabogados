-- Portal del cliente: el cliente entra con su propia cuenta y ve solo lo que el despacho decide mostrarle.
-- Los clientes NUNCA leen las tablas internas (clients, cases, documents): solo funciones que devuelven
-- columnas seguras, más las tablas case_milestones y case_updates, que contienen solo texto pensado para el cliente.

-- ───────────── Columnas nuevas ─────────────
alter table public.cases
  add column if not exists client_next_step text,
  add column if not exists client_next_step_date date,
  add column if not exists client_summary text;

alter table public.documents
  add column if not exists visible_to_client boolean not null default false;

-- ───────────── Etapas y avances visibles al cliente ─────────────
create table public.case_milestones (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  position int not null default 0,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'pendiente' check (status in ('pendiente', 'en_curso', 'hecha')),
  completed_on date,
  created_at timestamptz not null default now()
);
create index case_milestones_case_idx on public.case_milestones (case_id, position);
create index case_milestones_firm_idx on public.case_milestones (firm_id);

create table public.case_updates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 3000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index case_updates_case_idx on public.case_updates (case_id, created_at desc);
create index case_updates_firm_idx on public.case_updates (firm_id);
create index case_updates_created_by_idx on public.case_updates (created_by);

-- ───────────── Cuentas de cliente e invitaciones ─────────────
create table public.client_users (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  firm_id uuid not null references public.firms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
create index client_users_client_idx on public.client_users (client_id);
create index client_users_firm_idx on public.client_users (firm_id);

create table public.client_invites (
  code text primary key,
  client_id uuid not null references public.clients (id) on delete cascade,
  firm_id uuid not null references public.firms (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);
create index client_invites_client_idx on public.client_invites (client_id);
create index client_invites_firm_idx on public.client_invites (firm_id);
create index client_invites_created_by_idx on public.client_invites (created_by);
create index client_invites_used_by_idx on public.client_invites (used_by);

-- ───────────── Funciones de apoyo ─────────────
create or replace function public.is_client_of_case(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.cases k
    join public.client_users u on u.client_id = k.client_id
    where k.id = c and u.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_client_of_case(uuid) from public, anon;
grant execute on function public.is_client_of_case(uuid) to authenticated;

create or replace function public.can_client_read_file(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.storage_path = p_path
      and d.visible_to_client
      and d.case_id is not null
      and public.is_client_of_case(d.case_id)
  );
$$;
revoke all on function public.can_client_read_file(text) from public, anon;
grant execute on function public.can_client_read_file(text) to authenticated;

-- El abogado genera un código de un solo uso para que el cliente cree su cuenta
create or replace function public.create_client_invite(p_client uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid;
  v_code text;
begin
  select firm_id into v_firm from public.clients where id = p_client;
  if v_firm is null or not public.is_member(v_firm) then
    raise exception 'Cliente no encontrado';
  end if;
  delete from public.client_invites where client_id = p_client and used_at is null;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.client_invites (code, client_id, firm_id) values (v_code, p_client, v_firm);
  return v_code;
end;
$$;
revoke all on function public.create_client_invite(uuid) from public, anon;
grant execute on function public.create_client_invite(uuid) to authenticated;

-- El cliente canjea el código con su cuenta ya creada
create or replace function public.claim_client_invite(p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.client_invites%rowtype;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if exists (select 1 from public.firm_members where user_id = v_uid) then
    raise exception 'Esta cuenta pertenece a un despacho';
  end if;
  select * into v_inv from public.client_invites
   where code = v_code and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'Código inválido o vencido'; end if;
  insert into public.client_users (user_id, client_id, firm_id)
  values (v_uid, v_inv.client_id, v_inv.firm_id)
  on conflict do nothing;
  update public.client_invites set used_at = now(), used_by = v_uid where code = v_inv.code;
end;
$$;
revoke all on function public.claim_client_invite(text) from public, anon;
grant execute on function public.claim_client_invite(text) to authenticated;

-- Un usuario que ya es cliente no puede crear un despacho
create or replace function public.create_firm(p_name text, p_full_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_firm uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if exists (select 1 from public.firm_members where user_id = v_uid) then
    raise exception 'Ya perteneces a un despacho';
  end if;
  if exists (select 1 from public.client_users where user_id = v_uid) then
    raise exception 'Esta cuenta es de cliente';
  end if;
  insert into public.firms (name, created_by) values (trim(p_name), v_uid) returning id into v_firm;
  insert into public.firm_members (firm_id, user_id, role, full_name) values (v_firm, v_uid, 'owner', nullif(trim(p_full_name), ''));
  return v_firm;
end;
$$;
revoke all on function public.create_firm(text, text) from public, anon;
grant execute on function public.create_firm(text, text) to authenticated;

-- ───────────── Lo que ve el cliente (solo columnas seguras) ─────────────
create or replace function public.portal_my_cases()
returns table (
  id uuid, title text, case_type text, court text, file_number text, status text,
  opened_on date, next_step text, next_step_date date, summary text,
  client_name text, firm_name text
)
language sql stable security definer set search_path = '' as $$
  select k.id, k.title, k.case_type, k.court, k.file_number, k.status, k.opened_on,
         k.client_next_step, k.client_next_step_date, k.client_summary,
         c.full_name, f.name
  from public.client_users u
  join public.clients c on c.id = u.client_id
  join public.cases k on k.client_id = c.id
  join public.firms f on f.id = k.firm_id
  where u.user_id = (select auth.uid()) and k.status <> 'archivado'
  order by k.created_at desc;
$$;
revoke all on function public.portal_my_cases() from public, anon;
grant execute on function public.portal_my_cases() to authenticated;

create or replace function public.portal_case_documents(p_case uuid)
returns table (id uuid, title text, category text, file_name text, size_bytes bigint, created_at timestamptz, storage_path text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.title, d.category, d.file_name, d.size_bytes, d.created_at, d.storage_path
  from public.documents d
  where d.case_id = p_case and d.visible_to_client and public.is_client_of_case(p_case)
  order by d.created_at desc;
$$;
revoke all on function public.portal_case_documents(uuid) from public, anon;
grant execute on function public.portal_case_documents(uuid) to authenticated;

-- ───────────── Seguridad por fila ─────────────
alter table public.case_milestones enable row level security;
alter table public.case_updates enable row level security;
alter table public.client_users enable row level security;
alter table public.client_invites enable row level security;

do $$
declare t text;
begin
  foreach t in array array['case_milestones', 'case_updates'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(firm_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(firm_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(firm_id)) with check (public.is_member(firm_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member(firm_id))', t || '_delete', t);
    -- El cliente solo lee las de sus propios casos
    execute format('create policy %I on public.%I for select to authenticated using (public.is_client_of_case(case_id))', t || '_client_select', t);
  end loop;
end $$;

create policy client_users_select on public.client_users for select to authenticated
  using (public.is_member(firm_id) or user_id = (select auth.uid()));
create policy client_users_delete on public.client_users for delete to authenticated
  using (public.is_member(firm_id));

create policy client_invites_select on public.client_invites for select to authenticated
  using (public.is_member(firm_id));
create policy client_invites_delete on public.client_invites for delete to authenticated
  using (public.is_member(firm_id));

-- Archivos: el cliente solo descarga los que el despacho marcó como visibles en sus casos
create policy firm_docs_client_select on storage.objects for select to authenticated
  using (bucket_id = 'firm-documents' and public.can_client_read_file(name));
