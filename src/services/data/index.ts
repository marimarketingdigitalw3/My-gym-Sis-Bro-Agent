import { createLocalDataClient } from "./localClient";
import { createSupabaseDataClient } from "./supabaseClient";
import type { DataClient } from "./types";

export * from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sin credenciales de Supabase la app funciona en modo demo local, claramente identificado en la interfaz. */
export const db: DataClient = url && anonKey ? createSupabaseDataClient(url, anonKey) : createLocalDataClient();
