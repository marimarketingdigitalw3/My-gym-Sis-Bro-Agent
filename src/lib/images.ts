// Reduce una foto antes de subirla al coach: lado máximo 1280 px, JPEG. Evita subidas pesadas desde el móvil.
export const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024;

export async function compressImage(file: File, maxSide = 1280, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Solo se pueden adjuntar imágenes.");
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin canvas");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("sin blob");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // Si el navegador no puede procesarla, se sube tal cual (dentro del límite).
    if (file.size > MAX_CHAT_IMAGE_BYTES) throw new Error("La foto es demasiado grande (máximo 4 MB).");
    return file;
  }
}

/**
 * Extrae `count` fotogramas JPEG repartidos a lo largo de un video (lado máximo 1280 px).
 * Devuelve los que el navegador consiga decodificar; puede ser una lista vacía si el códec no es compatible.
 */
export async function extractVideoFrames(file: File, count = 4, maxSide = 1280, quality = 0.8): Promise<File[]> {
  if (!file.type.startsWith("video/")) throw new Error("El archivo no es un video.");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  const frames: File[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 15000);
      video.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
      video.onerror = () => { clearTimeout(timer); reject(new Error("video")); };
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth || 1, video.videoHeight || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((video.videoWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || 1) * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    const base = file.name.replace(/\.[^.]+$/, "");
    for (let i = 0; i < count; i++) {
      // Puntos repartidos entre el 10 % y el 90 % para evitar los fotogramas negros del inicio y el final.
      const t = duration ? duration * (0.1 + (0.8 * i) / Math.max(1, count - 1)) : 0;
      const ok = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 8000);
        video.onseeked = () => { clearTimeout(timer); resolve(true); };
        video.onerror = () => { clearTimeout(timer); resolve(false); };
        video.currentTime = t;
      });
      if (!ok) break;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob) frames.push(new File([blob], `${base}.f${i}.jpg`, { type: "image/jpeg" }));
    }
  } catch {
    // Sin fotogramas: el video se sube igualmente y el coach pedirá una foto si hace falta.
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
  return frames;
}
