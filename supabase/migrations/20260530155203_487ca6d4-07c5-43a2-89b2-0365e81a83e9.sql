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

  select s.data
    into v_survey
  from public.surveys s
  where s.data->>'publicShareToken' = p_token
    and coalesce((s.data->>'publicShareEnabled')::boolean, false) = true
    and (s.data->>'publicShareRevokedAt' is null or s.data->>'publicShareRevokedAt' = '')
  limit 1;

  if v_survey is null then
    return null;
  end if;

  if nullif(v_survey->>'customTypeId', '') is not null then
    select c.data
      into v_custom_type
    from public.custom_survey_types c
    where c.id = v_survey->>'customTypeId'
    limit 1;
  end if;

  select fo.data
    into v_form_overrides
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

  select s.id, s.data
    into v_id, v_current
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