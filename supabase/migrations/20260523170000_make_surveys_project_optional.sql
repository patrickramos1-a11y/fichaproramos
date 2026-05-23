alter table public.surveys
  alter column project_id drop not null;

alter table public.surveys
  add column if not exists client_id text,
  add column if not exists empreendimento_id text;

create index if not exists surveys_client_id_idx on public.surveys(client_id);
create index if not exists surveys_empreendimento_id_idx on public.surveys(empreendimento_id);
