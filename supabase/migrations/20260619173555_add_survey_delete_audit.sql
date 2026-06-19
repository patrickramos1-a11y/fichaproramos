create table if not exists public.deleted_surveys_audit (
  id text primary key,
  project_id text,
  data jsonb not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_surveys_audit enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deleted_surveys_audit'
      and policyname = 'auth_select_deleted_surveys_audit'
  ) then
    create policy "auth_select_deleted_surveys_audit"
      on public.deleted_surveys_audit
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deleted_surveys_audit'
      and policyname = 'auth_insert_deleted_surveys_audit'
  ) then
    create policy "auth_insert_deleted_surveys_audit"
      on public.deleted_surveys_audit
      for insert
      to authenticated
      with check (auth.uid() is not null);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deleted_surveys_audit'
      and policyname = 'auth_update_deleted_surveys_audit'
  ) then
    create policy "auth_update_deleted_surveys_audit"
      on public.deleted_surveys_audit
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end$$;

create or replace function public.audit_deleted_survey()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.deleted_surveys_audit (id, project_id, data, deleted_by)
  values (old.id, old.project_id, old.data, auth.uid())
  on conflict (id) do update
    set project_id = excluded.project_id,
        data = excluded.data,
        deleted_by = excluded.deleted_by,
        deleted_at = now();
  return old;
end;
$$;

drop trigger if exists trg_surveys_delete_audit on public.surveys;
create trigger trg_surveys_delete_audit
before delete on public.surveys
for each row execute function public.audit_deleted_survey();

create or replace function public.restore_deleted_survey(survey_id text)
returns void
language plpgsql
set search_path = public
as $$
declare
  archived record;
begin
  select * into archived
  from public.deleted_surveys_audit
  where id = survey_id;

  if not found then
    raise exception 'deleted survey % not found in audit table', survey_id;
  end if;

  insert into public.surveys (id, project_id, data)
  values (archived.id, archived.project_id, archived.data)
  on conflict (id) do update
    set project_id = excluded.project_id,
        data = excluded.data;
end;
$$;
