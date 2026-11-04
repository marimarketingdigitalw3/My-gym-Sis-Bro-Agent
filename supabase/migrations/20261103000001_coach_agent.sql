-- Gym AI Coach como agente: fotos adjuntas y acciones propuestas en cada mensaje.

-- Rutas de fotos adjuntas (bucket chat-attachments) y acciones propuestas por el asistente.
alter table public.chat_messages
  add column attachments text[] not null default '{}' check (cardinality(attachments) <= 3),
  add column actions jsonb not null default '[]'::jsonb;

-- La app marca una acción como aplicada: la persona puede actualizar sus propios mensajes.
create policy "chat_messages_update_own" on public.chat_messages for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bucket privado para las fotos que se envían al coach (técnica, comidas, etiquetas de suplementos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "chat_attachments_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat_attachments_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat_attachments_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
