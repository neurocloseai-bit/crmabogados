-- Despacho CRM · esquema multi-despacho con seguridad por fila (RLS)
-- Cada despacho (firm) es un espacio aislado; los usuarios entran por firm_members.

create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'admin', 'abogado', 'asistente');

-- ───────────── Despachos y miembros ─────────────
create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.firm_members (
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'abogado',
  full_name text,
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);
create index firm_members_user_idx on public.firm_members (user_id);

-- Funciones de apoyo para las políticas (no ejecutables por anónimos)
create or replace function public.is_member(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.firm_members m
    where m.firm_id = f and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_firm_admin(f uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.firm_members m
    where m.firm_id = f and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_firm_admin(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_firm_admin(uuid) to authenticated;

-- Crear un despacho y quedar como dueño, en un solo paso
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
  insert into public.firms (name, created_by) values (trim(p_name), v_uid) returning id into v_firm;
  insert into public.firm_members (firm_id, user_id, role, full_name) values (v_firm, v_uid, 'owner', nullif(trim(p_full_name), ''));
  return v_firm;
end;
$$;
revoke all on function public.create_firm(text, text) from public, anon;
grant execute on function public.create_firm(text, text) to authenticated;

-- ───────────── Datos del despacho ─────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  name text not null,
  phone text,
  source text,
  case_type text,
  stage text not null default 'nuevo' check (stage in ('nuevo','contactado','consulta','cotizado','cliente','perdido')),
  quoted numeric(12,2) not null default 0 check (quoted >= 0),
  follow_up_date date,
  notes text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  case_type text,
  court text,
  file_number text,
  counterpart text,
  status text not null default 'activo' check (status in ('activo','suspendido','concluido','archivado')),
  opened_on date,
  fees numeric(12,2) not null default 0 check (fees >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  case_id uuid references public.cases (id) on delete cascade,
  title text not null,
  kind text not null default 'termino' check (kind in ('termino','audiencia','cita','pago','otro')),
  due_date date not null,
  due_time time,
  court text,
  file_number text,
  notes text,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  day date not null,
  label text,
  unique (firm_id, day)
);

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  total numeric(12,2) not null check (total > 0),
  down_payment numeric(12,2) not null default 0 check (down_payment >= 0),
  installments int not null default 1 check (installments between 1 and 120),
  frequency text not null default 'mensual' check (frequency in ('semanal','quincenal','mensual')),
  first_due date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  plan_id uuid references public.payment_plans (id) on delete cascade,
  kind text not null default 'mensualidad' check (kind in ('anticipo','mensualidad','pago')),
  amount numeric(12,2) not null check (amount > 0),
  due_date date,
  paid_on date,
  method text,
  note text,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  title text not null,
  category text not null default 'machote' check (category in ('machote','demanda','contestacion','escrito','contrato','poder','otro')),
  description text,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Índices por despacho y por llaves foráneas
create index leads_firm_idx on public.leads (firm_id, stage);
create index clients_firm_idx on public.clients (firm_id);
create index clients_lead_idx on public.clients (lead_id);
create index cases_firm_idx on public.cases (firm_id, status);
create index cases_client_idx on public.cases (client_id);
create index deadlines_firm_idx on public.deadlines (firm_id, done, due_date);
create index deadlines_case_idx on public.deadlines (case_id);
create index holidays_firm_idx on public.holidays (firm_id);
create index plans_firm_idx on public.payment_plans (firm_id);
create index plans_case_idx on public.payment_plans (case_id);
create index payments_firm_idx on public.payments (firm_id, paid_on);
create index payments_case_idx on public.payments (case_id);
create index payments_plan_idx on public.payments (plan_id);
create index documents_firm_idx on public.documents (firm_id, category);
create index documents_case_idx on public.documents (case_id);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();
create trigger cases_touch before update on public.cases for each row execute function public.touch_updated_at();

-- ───────────── Seguridad por fila ─────────────
alter table public.firms enable row level security;
alter table public.firm_members enable row level security;

create policy firms_select on public.firms for select to authenticated using (public.is_member(id));
create policy firms_update on public.firms for update to authenticated using (public.is_firm_admin(id)) with check (public.is_firm_admin(id));

create policy members_select on public.firm_members for select to authenticated using (public.is_member(firm_id));
create policy members_update on public.firm_members for update to authenticated using (public.is_firm_admin(firm_id)) with check (public.is_firm_admin(firm_id));
create policy members_delete on public.firm_members for delete to authenticated using (public.is_firm_admin(firm_id) and user_id <> (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['leads','clients','cases','deadlines','holidays','payment_plans','payments','documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(firm_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(firm_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(firm_id)) with check (public.is_member(firm_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member(firm_id))', t || '_delete', t);
  end loop;
end $$;

-- ───────────── Archivos (machotes, escritos, contratos) ─────────────
-- Ruta de cada archivo: <firm_id>/<uuid>-<nombre>. Solo miembros de ese despacho acceden.
insert into storage.buckets (id, name, public, file_size_limit)
values ('firm-documents', 'firm-documents', false, 26214400)
on conflict (id) do nothing;

create policy firm_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'firm-documents' and exists (
    select 1 from public.firm_members m where m.user_id = (select auth.uid()) and m.firm_id::text = (storage.foldername(name))[1]));
create policy firm_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'firm-documents' and exists (
    select 1 from public.firm_members m where m.user_id = (select auth.uid()) and m.firm_id::text = (storage.foldername(name))[1]));
create policy firm_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'firm-documents' and exists (
    select 1 from public.firm_members m where m.user_id = (select auth.uid()) and m.firm_id::text = (storage.foldername(name))[1]));
create policy firm_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'firm-documents' and exists (
    select 1 from public.firm_members m where m.user_id = (select auth.uid()) and m.firm_id::text = (storage.foldername(name))[1]));
