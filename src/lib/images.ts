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
