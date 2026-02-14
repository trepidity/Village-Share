-- Storage bucket for item photos
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true);

-- Allow authenticated users to upload
create policy "Authenticated users can upload item photos"
  on storage.objects for insert
  with check (
    bucket_id = 'item-photos'
    and auth.role() = 'authenticated'
  );

-- Allow public read access
create policy "Anyone can view item photos"
  on storage.objects for select
  using (bucket_id = 'item-photos');

-- Allow owners to delete their uploads
create policy "Users can delete their own item photos"
  on storage.objects for delete
  using (
    bucket_id = 'item-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
