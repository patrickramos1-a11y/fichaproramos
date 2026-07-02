create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.empreendimentos (
  id text primary key,
  client_id text not null,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  client_id text not null,
  empreendimento_id text,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.surveys (
  id text primary key,
  project_id text,
  client_id text,
  empreendimento_id text,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_templates (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_survey_types (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_overrides (
  id text primary key default 'singleton',
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.annual_environmental_records (
  id text primary key,
  client_id text not null,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table if exists public.surveys alter column project_id drop not null;
alter table if exists public.surveys add column if not exists client_id text;
alter table if exists public.surveys add column if not exists empreendimento_id text;

create index if not exists empreendimentos_client_id_idx on public.empreendimentos(client_id);
create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists projects_empreendimento_id_idx on public.projects(empreendimento_id);
create index if not exists surveys_project_id_idx on public.surveys(project_id);
create index if not exists surveys_client_id_idx on public.surveys(client_id);
create index if not exists surveys_empreendimento_id_idx on public.surveys(empreendimento_id);
create index if not exists annual_environmental_records_client_id_idx on public.annual_environmental_records(client_id);

drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists trg_empreendimentos_updated on public.empreendimentos;
create trigger trg_empreendimentos_updated before update on public.empreendimentos for each row execute function public.set_updated_at();
drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists trg_surveys_updated on public.surveys;
create trigger trg_surveys_updated before update on public.surveys for each row execute function public.set_updated_at();
drop trigger if exists trg_survey_templates_updated on public.survey_templates;
create trigger trg_survey_templates_updated before update on public.survey_templates for each row execute function public.set_updated_at();
drop trigger if exists trg_custom_survey_types_updated on public.custom_survey_types;
create trigger trg_custom_survey_types_updated before update on public.custom_survey_types for each row execute function public.set_updated_at();
drop trigger if exists trg_form_overrides_updated on public.form_overrides;
create trigger trg_form_overrides_updated before update on public.form_overrides for each row execute function public.set_updated_at();
drop trigger if exists trg_annual_environmental_records_updated on public.annual_environmental_records;
create trigger trg_annual_environmental_records_updated before update on public.annual_environmental_records for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  for t in select unnest(array[
    'clients','empreendimentos','projects','surveys',
    'survey_templates','custom_survey_types','form_overrides',
    'annual_environmental_records'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "auth_select_%s" on public.%I', t, t);
    execute format('drop policy if exists "auth_insert_%s" on public.%I', t, t);
    execute format('drop policy if exists "auth_update_%s" on public.%I', t, t);
    execute format('drop policy if exists "auth_delete_%s" on public.%I', t, t);
    execute format('create policy "auth_select_%1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "auth_insert_%1$s" on public.%1$I for insert to authenticated with check (auth.uid() is not null)', t);
    execute format('create policy "auth_update_%1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "auth_delete_%1$s" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end$$;

alter table public.app_users enable row level security;
drop policy if exists "anyone can read app_users" on public.app_users;
drop policy if exists "anyone can insert app_users" on public.app_users;
drop policy if exists "anyone can delete app_users" on public.app_users;
create policy "anyone can read app_users" on public.app_users for select using (true);
create policy "anyone can insert app_users" on public.app_users for insert with check (true);
create policy "anyone can delete app_users" on public.app_users for delete using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
grant select, insert, update, delete on table public.empreendimentos to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.surveys to authenticated;
grant select, insert, update, delete on table public.survey_templates to authenticated;
grant select, insert, update, delete on table public.custom_survey_types to authenticated;
grant select, insert, update, delete on table public.form_overrides to authenticated;
grant select, insert, update, delete on table public.annual_environmental_records to authenticated;
grant select, insert, delete on table public.app_users to anon, authenticated;

revoke all on table public.clients from anon;
revoke all on table public.empreendimentos from anon;
revoke all on table public.projects from anon;
revoke all on table public.surveys from anon;
revoke all on table public.survey_templates from anon;
revoke all on table public.custom_survey_types from anon;
revoke all on table public.form_overrides from anon;
revoke all on table public.annual_environmental_records from anon;

create or replace function public.get_public_survey(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey jsonb;
  v_custom_type jsonb;
  v_form_overrides jsonb;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    return null;
  end if;
  select s.data into v_survey
  from public.surveys s
  where s.data->>'publicShareToken' = p_token
    and coalesce((s.data->>'publicShareEnabled')::boolean, false) = true
    and (s.data->>'publicShareRevokedAt' is null or s.data->>'publicShareRevokedAt' = '')
  limit 1;
  if v_survey is null then
    return null;
  end if;
  if nullif(v_survey->>'customTypeId', '') is not null then
    select c.data into v_custom_type
    from public.custom_survey_types c
    where c.id = v_survey->>'customTypeId'
    limit 1;
  end if;
  select fo.data into v_form_overrides
  from public.form_overrides fo
  where fo.id = 'singleton'
  limit 1;
  return jsonb_build_object(
    'survey', v_survey,
    'customType', v_custom_type,
    'formOverrides', coalesce(v_form_overrides, '{}'::jsonb)
  );
end;
$$;

create or replace function public.update_public_survey(
  p_token text,
  p_patch jsonb,
  p_editor_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_current jsonb;
  v_next jsonb;
begin
  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'Token publico invalido.';
  end if;
  select s.id, s.data into v_id, v_current
  from public.surveys s
  where s.data->>'publicShareToken' = p_token
    and coalesce((s.data->>'publicShareEnabled')::boolean, false) = true
    and (s.data->>'publicShareRevokedAt' is null or s.data->>'publicShareRevokedAt' = '')
  limit 1;
  if v_id is null then
    raise exception 'Link publico invalido, revogado ou expirado.';
  end if;
  v_next := v_current;
  if p_patch ? 'modules' then
    v_next := jsonb_set(v_next, '{modules}', coalesce(p_patch->'modules', '{}'::jsonb), true);
  end if;
  if p_patch ? 'pendencias' then
    v_next := jsonb_set(v_next, '{pendencias}', coalesce(p_patch->'pendencias', '[]'::jsonb), true);
  end if;
  if p_patch ? 'signatures' then
    v_next := jsonb_set(v_next, '{signatures}', coalesce(p_patch->'signatures', '{}'::jsonb), true);
  end if;
  v_next := jsonb_set(v_next, '{publicShareLastSubmittedAt}', to_jsonb(now()::text), true);
  if nullif(trim(coalesce(p_editor_name, '')), '') is not null then
    v_next := jsonb_set(v_next, '{publicShareLastEditorName}', to_jsonb(trim(p_editor_name)), true);
  end if;
  update public.surveys
     set data = v_next,
         updated_at = now()
   where id = v_id;
  return public.get_public_survey(p_token);
end;
$$;

revoke all on function public.get_public_survey(text) from public;
revoke all on function public.update_public_survey(text, jsonb, text) from public;
grant execute on function public.get_public_survey(text) to anon, authenticated;
grant execute on function public.update_public_survey(text, jsonb, text) to anon, authenticated;

do $$
declare t regclass;
begin
  foreach t in array array[
    'public.clients'::regclass,
    'public.empreendimentos'::regclass,
    'public.projects'::regclass,
    'public.surveys'::regclass,
    'public.survey_templates'::regclass,
    'public.custom_survey_types'::regclass,
    'public.form_overrides'::regclass,
    'public.annual_environmental_records'::regclass
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %s', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
      when insufficient_privilege then null;
    end;
  end loop;
end$$;

alter table public.clients replica identity full;
alter table public.empreendimentos replica identity full;
alter table public.projects replica identity full;
alter table public.surveys replica identity full;
alter table public.survey_templates replica identity full;
alter table public.custom_survey_types replica identity full;
alter table public.form_overrides replica identity full;
alter table public.annual_environmental_records replica identity full;