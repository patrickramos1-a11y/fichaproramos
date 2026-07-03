-- Índices para acelerar consultas de link público de surveys por token
create index if not exists idx_surveys_public_share_token
  on public.surveys ((data->>'publicShareToken'))
  where data->>'publicShareToken' is not null;

create index if not exists idx_surveys_public_share_enabled
  on public.surveys (((data->>'publicShareEnabled')::boolean))
  where (data->>'publicShareEnabled')::boolean = true;

notify pgrst, 'reload schema';