import { createLocalDataClient } from "./localClient";
import { createSupabaseDataClient } from "./supabaseClient";
import type { DataClient } from "./types";

export * from "./types";

// Acepta los nombres propios de la app o los que crea la integración Supabase de Vercel.
const env = import.meta.env;
const url = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

/** Sin credenciales de Supabase la app funciona en modo demo local, claramente identificado en la interfaz. */
export const db: DataClient = url && anonKey ? createSupabaseDataClient(url, anonKey) : createLocalDataClient();
