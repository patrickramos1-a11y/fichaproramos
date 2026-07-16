
create policy "survey-photos authenticated read"
  on storage.objects for select to authenticated
  using (bucket_id = 'survey-photos');

create policy "survey-photos authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'survey-photos');

create policy "survey-photos authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'survey-photos')
  with check (bucket_id = 'survey-photos');

create policy "survey-photos authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'survey-photos');
