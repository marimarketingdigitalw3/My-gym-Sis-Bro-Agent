// Gym Sis · Mis outfits: perfil de estilo, clóset deportivo con fotos y consejos de combinación.
import { db } from "./data";
import { compressImage } from "@/lib/images";
import type { StyleAdviceRow, StyleProfileRow, WardrobeItemRow } from "@/types/db";

const BUCKET = "wardrobe" as const;

export async function getStyleProfile(): Promise<StyleProfileRow | null> {
  const [row] = await db.select("style_profiles");
  return row ?? null;
}

export async function saveStyleProfile(patch: Partial<StyleProfileRow>) {
  await db.upsert("style_profiles", [{ ...patch, updated_at: new Date().toISOString() }], ["user_id"]);
}

export const listWardrobe = () => db.select("wardrobe_items", { order: { column: "created_at", ascending: false } });

export async function addWardrobeItem(userId: string, file: File, meta: Pick<WardrobeItemRow, "category" | "colors" | "name">): Promise<WardrobeItemRow> {
  const small = await compressImage(file, 1024);
  const path = `${userId}/wardrobe/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await db.uploadPhoto(path, small, BUCKET);
  try {
    const [row] = await db.insert("wardrobe_items", [{ storage_path: path, ...meta }]);
    return row;
  } catch (e) {
    await db.removePhotos([path], BUCKET);
    throw e;
  }
}

export async function updateWardrobeItem(id: string, patch: Partial<Pick<WardrobeItemRow, "category" | "colors" | "name">>) {
  await db.update("wardrobe_items", { id }, patch);
}

export async function removeWardrobeItem(item: Pick<WardrobeItemRow, "id" | "storage_path">) {
  await db.remove("wardrobe_items", { id: item.id });
  await db.removePhotos([item.storage_path], BUCKET);
}

export const wardrobeUrl = (path: string) => db.photoUrl(path, BUCKET);

export const listStyleAdvice = () => db.select("style_advice", { order: { column: "created_at", ascending: false }, limit: 10 });

export const requestStyleAdvice = (req: { activity: string; itemIds: string[]; question: string }) => db.requestStyleAdvice(req);

export const deleteStyleAdvice = (id: string) => db.remove("style_advice", { id });

export type { StyleAdviceRow, StyleProfileRow, WardrobeItemRow };
