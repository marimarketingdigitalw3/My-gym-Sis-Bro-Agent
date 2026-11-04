-- Gym AI Coach: videos cortos adjuntos (la app sube el video y hasta 4 fotogramas JPEG por video).
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
where id = 'chat-attachments';
