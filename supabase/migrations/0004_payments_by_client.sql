-- Los pagos y planes se ligan al cliente; el expediente pasa a ser opcional (el juzgado aún no da número al contratar).
alter table public.payment_plans add column client_id uuid references public.clients (id) on delete cascade;
alter table public.payments add column client_id uuid references public.clients (id) on delete cascade;

update public.payment_plans p set client_id = c.client_id from public.cases c where c.id = p.case_id;
update public.payments p set client_id = c.client_id from public.cases c where c.id = p.case_id;

alter table public.payment_plans alter column client_id set not null;
alter table public.payments alter column client_id set not null;
alter table public.payment_plans alter column case_id drop not null;
alter table public.payments alter column case_id drop not null;

create index payment_plans_client_idx on public.payment_plans (client_id);
create index payments_client_idx on public.payments (client_id);
