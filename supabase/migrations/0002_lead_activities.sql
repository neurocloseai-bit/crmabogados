-- Historial de seguimiento de cada lead (llamadas, WhatsApp, notas, reuniones)
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null default 'nota' check (kind in ('llamada','whatsapp','nota','reunion','otro')),
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, occurred_at desc);
create index lead_activities_firm_idx on public.lead_activities (firm_id);
create index lead_activities_created_by_idx on public.lead_activities (created_by);

alter table public.lead_activities enable row level security;
create policy lead_activities_select on public.lead_activities for select to authenticated using (public.is_member(firm_id));
create policy lead_activities_insert on public.lead_activities for insert to authenticated with check (public.is_member(firm_id));
create policy lead_activities_update on public.lead_activities for update to authenticated using (public.is_member(firm_id)) with check (public.is_member(firm_id));
create policy lead_activities_delete on public.lead_activities for delete to authenticated using (public.is_member(firm_id));
