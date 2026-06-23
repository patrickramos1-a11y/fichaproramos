create table if not exists clients (
  id text primary key,
  data text not null,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists empreendimentos (
  id text primary key,
  client_id text,
  data text not null,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists projects (
  id text primary key,
  client_id text,
  empreendimento_id text,
  data text not null,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists surveys (
  id text primary key,
  client_id text,
  project_id text,
  empreendimento_id text,
  data text not null,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists survey_templates (
  id text primary key,
  data text not null,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists custom_survey_types (
  id text primary key,
  data text not null,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists annual_environmental_records (
  id text primary key,
  client_id text,
  data text not null,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists form_overrides (
  id text primary key default 'singleton',
  data text not null default '{}',
  updated_by text,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists app_users (
  id text primary key,
  name text not null unique,
  email text not null unique,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists deleted_surveys_audit (
  id text primary key,
  client_id text,
  project_id text,
  empreendimento_id text,
  data text not null,
  deleted_by text,
  deleted_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists sync_operations_log (
  operation_id text primary key,
  table_name text not null,
  record_id text not null,
  operation_type text not null,
  applied_by text,
  applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  error text
);

create index if not exists empreendimentos_client_id_idx on empreendimentos(client_id);
create index if not exists projects_client_id_idx on projects(client_id);
create index if not exists projects_empreendimento_id_idx on projects(empreendimento_id);
create index if not exists surveys_client_id_idx on surveys(client_id);
create index if not exists surveys_project_id_idx on surveys(project_id);
create index if not exists surveys_empreendimento_id_idx on surveys(empreendimento_id);
create index if not exists surveys_updated_at_idx on surveys(updated_at);
create index if not exists annual_environmental_records_client_id_idx on annual_environmental_records(client_id);
create index if not exists sync_operations_log_record_idx on sync_operations_log(table_name, record_id);

drop trigger if exists trg_surveys_delete_audit;
create trigger trg_surveys_delete_audit
before delete on surveys
for each row
begin
  insert into deleted_surveys_audit (
    id,
    client_id,
    project_id,
    empreendimento_id,
    data,
    deleted_at
  )
  values (
    old.id,
    old.client_id,
    old.project_id,
    old.empreendimento_id,
    old.data,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  )
  on conflict(id) do update set
    client_id = excluded.client_id,
    project_id = excluded.project_id,
    empreendimento_id = excluded.empreendimento_id,
    data = excluded.data,
    deleted_at = excluded.deleted_at;
end;
