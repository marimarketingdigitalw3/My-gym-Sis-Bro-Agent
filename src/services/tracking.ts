// Nutrición, agua, progreso, bienestar, ciclo y coach.
import { db } from "./data";
import { compressImage, extractVideoFrames } from "@/lib/images";
import { MAX_VIDEO_BYTES, VIDEO_FRAMES, videoFramePath, type StoredAction } from "../../supabase/functions/_shared/coachActions.ts";
import type {
  CycleLogRow, MealLogRow, MealPlanDay, MealPlanRow, MeasurementRow, RecoveryLogRow,
} from "@/types/db";

// ---------- Nutrición ----------
export async function getMealPlan(weekStart: string): Promise<MealPlanRow | null> {
  const [plan] = await db.select("meal_plans", { eq: { week_start: weekStart } });
  return plan ?? null;
}

export async function saveMealPlan(weekStart: string, days: MealPlanDay[], targets: MealPlanRow["targets"]): Promise<MealPlanRow> {
  const [plan] = await db.upsert("meal_plans", [{ week_start: weekStart, days, targets }], ["user_id", "week_start"]);
  return plan;
}

export async function listMealLogs(from: string, to: string) {
  return db.select("meal_logs", { gte: { logged_on: from }, lte: { logged_on: to }, order: { column: "created_at" } });
}

export async function addMealLog(row: Omit<MealLogRow, "id" | "user_id" | "created_at">) {
  const [created] = await db.insert("meal_logs", [row]);
  return created;
}

export async function updateMealLog(id: string, patch: Partial<MealLogRow>) {
  await db.update("meal_logs", { id }, patch);
}

export async function deleteMealLog(id: string) {
  await db.remove("meal_logs", { id });
}

export async function getWater(date: string) {
  const [row] = await db.select("water_logs", { eq: { logged_on: date } });
  return row?.ml ?? 0;
}

export async function setWater(date: string, ml: number) {
  await db.upsert("water_logs", [{ logged_on: date, ml: Math.max(0, Math.min(15000, ml)) }], ["user_id", "logged_on"]);
}

export async function listWater(from: string) {
  return db.select("water_logs", { gte: { logged_on: from } });
}

// ---------- Progreso ----------
export async function listMeasurements() {
  return db.select("progress_measurements", { order: { column: "measured_on" } });
}

export async function addMeasurement(row: Omit<MeasurementRow, "id" | "user_id" | "created_at">) {
  const [created] = await db.insert("progress_measurements", [row]);
  return created;
}

export async function deleteMeasurement(id: string) {
  await db.remove("progress_measurements", { id });
}

export async function listPhotos() {
  return db.select("progress_photos", { order: { column: "taken_on", ascending: false } });
}

export async function uploadPhoto(userId: string, file: File, takenOn: string, pose: "front" | "side" | "back" | "other") {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Formato no admitido. Usa JPG, PNG o WebP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("La foto supera 8 MB.");
  const ext = file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  await db.uploadPhoto(path, file);
  const [row] = await db.insert("progress_photos", [{ taken_on: takenOn, storage_path: path, pose }]);
  return row;
}

export async function deletePhoto(id: string, path: string) {
  await db.removePhotos([path]);
  await db.remove("progress_photos", { id });
}

export const photoUrl = (path: string) => db.photoUrl(path);

// ---------- Bienestar ----------
// ---------- Suplementos ----------
export async function listSupplementLogs(from: string) {
  return db.select("supplement_logs", { gte: { logged_on: from } });
}

export async function setSupplementTaken(date: string, supplement: string, taken: boolean) {
  if (taken) {
    const [row] = await db.upsert("supplement_logs", [{ logged_on: date, supplement, taken_at: new Date().toISOString() }], ["user_id", "logged_on", "supplement"]);
    return row;
  }
  await db.remove("supplement_logs", { logged_on: date, supplement });
  return null;
}

export async function getRecovery(date: string) {
  const [row] = await db.select("recovery_logs", { eq: { logged_on: date } });
  return row ?? null;
}

export async function listRecovery(from: string) {
  return db.select("recovery_logs", { gte: { logged_on: from }, order: { column: "logged_on" } });
}

export async function saveRecovery(row: Partial<RecoveryLogRow> & { logged_on: string }) {
  const [saved] = await db.upsert("recovery_logs", [row], ["user_id", "logged_on"]);
  return saved;
}

// ---------- Ciclo ----------
export async function listCycleLogs() {
  return db.select("cycle_logs", { order: { column: "logged_on" } });
}

export async function saveCycleLog(row: Partial<CycleLogRow> & { logged_on: string }) {
  const [saved] = await db.upsert("cycle_logs", [row], ["user_id", "logged_on"]);
  return saved;
}

export async function deleteCycleLog(id: string) {
  await db.remove("cycle_logs", { id });
}

export async function deleteAllCycleData() {
  await db.remove("cycle_logs", {});
  await db.remove("cycle_settings", {});
}

// ---------- Coach ----------
export async function listConversations() {
  return db.select("chat_conversations", { order: { column: "updated_at", ascending: false } });
}

export async function listMessages(conversationId: string) {
  return db.select("chat_messages", { eq: { conversation_id: conversationId }, order: { column: "created_at" } });
}

export async function deleteConversation(id: string) {
  await db.remove("chat_conversations", { id });
}

export const sendCoachMessage = (conversationId: string | null, message: string, attachments: string[] = []) => db.sendCoachMessage(conversationId, message, attachments);

const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };

/**
 * Sube un adjunto para el coach y devuelve su ruta en el bucket privado.
 * Foto: reducida en el navegador. Video: se sube tal cual (máximo 50 MB) junto con hasta 4 fotogramas
 * JPEG (`<nombre>.f0.jpg` …) que son lo que el modelo analiza.
 */
export async function uploadChatAttachment(userId: string, file: File): Promise<string> {
  const base = `${userId}/chat/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (file.type.startsWith("video/")) {
    const ext = VIDEO_EXT[file.type];
    if (!ext) throw new Error("Formato de video no compatible. Usa MP4, MOV o WebM.");
    if (file.size > MAX_VIDEO_BYTES) throw new Error("El video es demasiado grande (máximo 50 MB). Recórtalo a unos segundos.");
    const frames = await extractVideoFrames(file, VIDEO_FRAMES);
    const path = `${base}.${ext}`;
    await db.uploadPhoto(path, file, "chat-attachments");
    await Promise.all(frames.map((f, i) => db.uploadPhoto(videoFramePath(path, i), f, "chat-attachments")));
    return path;
  }
  const small = await compressImage(file);
  const path = `${base}.jpg`;
  await db.uploadPhoto(path, small, "chat-attachments");
  return path;
}

/** Compatibilidad: alias del nombre anterior. */
export const uploadChatImage = uploadChatAttachment;

export const chatImageUrl = (path: string) => db.photoUrl(path, "chat-attachments");

/** Guarda el estado de las acciones (aplicadas o no) de un mensaje del coach. */
export async function saveMessageActions(messageId: string, actions: StoredAction[]) {
  await db.update("chat_messages", { id: messageId }, { actions });
}
