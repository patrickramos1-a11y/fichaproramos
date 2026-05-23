-- Workspace-shared tables. All authenticated users can read/write everything.
-- Records use the application-generated string id; the full domain object lives in `data` (JSONB).

create table public.clients (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.empreendimentos (
  id text primary key,
  client_id text not null,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id text primary key,
  client_id text not null,
  empreendimento_id text,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.surveys (
  id text primary key,
  project_id text not null,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.survey_templates (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.custom_survey_types (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_overrides (
  id text primary key default 'singleton',
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index empreendimentos_client_id_idx on public.empreendimentos(client_id);
create index projects_client_id_idx on public.projects(client_id);
create index projects_empreendimento_id_idx on public.projects(empreendimento_id);
create index surveys_project_id_idx on public.surveys(project_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated before update on public.clients for each row execute function public.set_updated_at();
create trigger trg_empreendimentos_updated before update on public.empreendimentos for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_surveys_updated before update on public.surveys for each row execute function public.set_updated_at();
create trigger trg_survey_templates_updated before update on public.survey_templates for each row execute function public.set_updated_at();
create trigger trg_custom_survey_types_updated before update on public.custom_survey_types for each row execute function public.set_updated_at();
create trigger trg_form_overrides_updated before update on public.form_overrides for each row execute function public.set_updated_at();

-- Enable RLS and apply workspace-wide policies (all authenticated users).
do $$
declare t text;
begin
  for t in select unnest(array[
    'clients','empreendimentos','projects','surveys',
    'survey_templates','custom_survey_types','form_overrides'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "auth_select_%1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "auth_insert_%1$s" on public.%1$I for insert to authenticated with check (auth.uid() is not null)', t);
    execute format('create policy "auth_update_%1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "auth_delete_%1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end$$;

-- Realtime
alter publication supabase_realtime add table
  public.clients,
  public.empreendimentos,
  public.projects,
  public.surveys,
  public.survey_templates,
  public.custom_survey_types,
  public.form_overrides;

-- Send full row on UPDATE so Realtime payloads are useful
alter table public.clients replica identity full;
alter table public.empreendimentos replica identity full;
alter table public.projects replica identity full;
alter table public.surveys replica identity full;
alter table public.survey_templates replica identity full;
alter table public.custom_survey_types replica identity full;
alter table public.form_overrides replica identity full;