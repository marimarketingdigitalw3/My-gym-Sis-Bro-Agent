-- Gym Sis · Mis outfits: clóset deportivo con fotos, perfil de estilo y consejos de combinación.

create table public.style_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  styles text[] not null default '{}' check (cardinality(styles) <= 8),
  favorite_colors text[] not null default '{}' check (cardinality(favorite_colors) <= 10),
  avoid_colors text[] not null default '{}' check (cardinality(avoid_colors) <= 10),
  fit text check (fit in ('ajustado', 'holgado', 'mixto')),
  coverage text check (coverage in ('alta', 'media', 'baja')),
  activities text[] not null default '{}' check (cardinality(activities) <= 8),
  notes text check (char_length(notes) <= 300),
  updated_at timestamptz not null default now()
);

create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  category text not null check (category in ('top', 'sports_bra', 'leggings', 'shorts', 'set', 'jacket', 'shoes', 'accessory')),
  colors text[] not null default '{}' check (cardinality(colors) <= 5),
  name text check (char_length(name) <= 60),
  created_at timestamptz not null default now(),
  check (split_part(storage_path, '/', 1) = user_id::text)
);
create index wardrobe_items_user_idx on public.wardrobe_items (user_id, created_at);

create table public.style_advice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity text not null check (char_length(activity) <= 40),
  item_ids uuid[] not null default '{}' check (cardinality(item_ids) <= 6),
  question text check (char_length(question) <= 500),
  content text not null check (char_length(content) <= 8000),
  source text not null check (source in ('ai', 'fallback')),
  created_at timestamptz not null default now()
);
create index style_advice_user_idx on public.style_advice (user_id, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['style_profiles', 'wardrobe_items', 'style_advice'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end;
$$;

-- Bucket privado para las fotos de las prendas: cada persona solo accede a su carpeta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "wardrobe_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wardrobe_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
