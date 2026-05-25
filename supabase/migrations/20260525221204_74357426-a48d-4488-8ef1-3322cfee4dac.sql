create table if not exists public.annual_environmental_records (
  id text primary key,
  client_id text not null,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists annual_environmental_records_client_id_idx
  on public.annual_environmental_records(client_id);

drop trigger if exists trg_annual_environmental_records_updated on public.annual_environmental_records;

create trigger trg_annual_environmental_records_updated
  before update on public.annual_environmental_records
  for each row execute function public.set_updated_at();

alter table public.annual_environmental_records enable row level security;

drop policy if exists "auth_select_annual_environmental_records" on public.annual_environmental_records;
drop policy if exists "auth_insert_annual_environmental_records" on public.annual_environmental_records;
drop policy if exists "auth_update_annual_environmental_records" on public.annual_environmental_records;
drop policy if exists "auth_delete_annual_environmental_records" on public.annual_environmental_records;

create policy "auth_select_annual_environmental_records"
  on public.annual_environmental_records for select to authenticated using (true);

create policy "auth_insert_annual_environmental_records"
  on public.annual_environmental_records for insert to authenticated with check (auth.uid() is not null);

create policy "auth_update_annual_environmental_records"
  on public.annual_environmental_records for update to authenticated using (true) with check (true);

create policy "auth_delete_annual_environmental_records"
  on public.annual_environmental_records for delete to authenticated using (true);

do $$
begin
  alter publication supabase_realtime add table public.annual_environmental_records;
exception
  when duplicate_object then null;
end$$;

alter table public.annual_environmental_records replica identity full;