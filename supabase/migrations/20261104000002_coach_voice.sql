-- Voz del coach: los audios de las respuestas (mp3) se guardan en caché en <uid>/voice/ del bucket chat-attachments.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'audio/mpeg']
where id = 'chat-attachments';
