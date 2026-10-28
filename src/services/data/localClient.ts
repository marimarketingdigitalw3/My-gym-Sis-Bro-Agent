// Modo demo local: sin backend, todo queda en este navegador.
// Imita las reglas de Supabase (cada consulta se limita al usuario actual) para que la app
// se comporte igual en ambos modos. No es un sustituto seguro de un servidor.
import { EXERCISE_BY_ID } from "@/data/exercises";
import { startOfWeek, todayISO, weekdayIndex } from "@/lib/dates";
import { buildCoachContext } from "../../../supabase/functions/_shared/coachContext.ts";
import { conversationTitle } from "../../../supabase/functions/_shared/coach.ts";
import { fallbackReply } from "../../../supabase/functions/_shared/coachFallback.ts";
import type { ChatMessageRow, TableName } from "@/types/db";
import {
  DataError, PERSONAL_TABLES, SINGLETON_TABLES, type AuthService, type AuthUser, type CoachResponse, type DataClient,
  type QueryOptions, type Row,
} from "./types";

const DB_KEY = "mgs:local-db:v1";
const USERS_KEY = "mgs:local-users:v1";
const SESSION_KEY = "mgs:local-session:v1";

type AnyRow = Record<string, unknown>;
type Db = Partial<Record<TableName, AnyRow[]>>;
interface LocalUser { id: string; email: string; salt: string; hash: string; createdAt: string }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new DataError("No hay espacio de almacenamiento disponible en este navegador.");
  }
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" }, key, 256);
  return { salt: toHex(salt.buffer), hash: toHex(bits) };
}

// Fotos en IndexedDB (localStorage es demasiado pequeño para imágenes).
function photoStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("mgs-photos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await photoStore();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction("photos", mode).objectStore("photos"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function matches(row: AnyRow, opts: QueryOptions<AnyRow>): boolean {
  for (const [k, v] of Object.entries(opts.eq ?? {})) if (row[k] !== v) return false;
  for (const [k, v] of Object.entries(opts.gte ?? {})) if ((row[k] as string | number) < (v as string | number)) return false;
  for (const [k, v] of Object.entries(opts.lte ?? {})) if ((row[k] as string | number) > (v as string | number)) return false;
  if (opts.in && !opts.in.values.includes(row[opts.in.column as string] as string)) return false;
  return true;
}

export function createLocalDataClient(): DataClient {
  const listeners = new Set<(u: AuthUser | null, e: string) => void>();
  const session = () => read<AuthUser | null>(SESSION_KEY, null);
  const emit = (event: string) => listeners.forEach((l) => l(session(), event));

  function uid(): string {
    const s = session();
    if (!s) throw new DataError("Tu sesión expiró. Vuelve a iniciar sesión.", "unauthenticated", 401);
    return s.id;
  }
  const owner = (table: TableName) => (table === "profiles" ? "id" : "user_id");
  const load = () => read<Db>(DB_KEY, {});
  const scoped = (db: Db, table: TableName, userId: string) => (db[table] ?? []).filter((r) => r[owner(table)] === userId);

  function withDefaults(table: TableName, row: AnyRow, userId: string): AnyRow {
    const now = new Date().toISOString();
    const out: AnyRow = { ...row, [owner(table)]: userId };
    if (!SINGLETON_TABLES.has(table) && table !== "water_logs" && !out.id) out.id = crypto.randomUUID();
    if (["created_at", "started_at"].every((c) => !(c in out))) out.created_at = now;
    out.updated_at = now;
    return out;
  }

  const auth: AuthService = {
    async getUser() {
      return session();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signUp(email, password, displayName) {
      const users = read<LocalUser[]>(USERS_KEY, []);
      const normalized = email.trim().toLowerCase();
      if (users.some((u) => u.email === normalized)) throw new DataError("Ya existe una cuenta con ese correo en este navegador.");
      const { salt, hash } = await hashPassword(password);
      const user: LocalUser = { id: crypto.randomUUID(), email: normalized, salt, hash, createdAt: new Date().toISOString() };
      write(USERS_KEY, [...users, user]);
      // Igual que el trigger handle_new_user de la base de datos.
      const db = load();
      const now = new Date().toISOString();
      db.profiles = [...(db.profiles ?? []), {
        id: user.id, display_name: displayName.slice(0, 50), birth_date: null, height_cm: null, weight_kg: null, target_weight_kg: null,
        country: null, units: "metric", language: "es", sex: null, gender_identity: null, theme: "neutral", onboarding_step: 0,
        onboarding_completed: false, created_at: now, updated_at: now,
      }];
      db.user_settings = [...(db.user_settings ?? []), {
        user_id: user.id, cycle_tracking_enabled: false, water_tracking_enabled: true, calorie_tracking_enabled: true,
        ai_share_context: true, health_consent_at: null, updated_at: now,
      }];
      write(DB_KEY, db);
      write(SESSION_KEY, { id: user.id, email: user.email });
      emit("SIGNED_IN");
      return { needsEmailVerification: false };
    },
    async signIn(email, password) {
      const user = read<LocalUser[]>(USERS_KEY, []).find((u) => u.email === email.trim().toLowerCase());
      const ok = user && (await hashPassword(password, user.salt)).hash === user.hash;
      if (!user || !ok) throw new DataError("Correo o contraseña incorrectos.");
      write(SESSION_KEY, { id: user.id, email: user.email });
      emit("SIGNED_IN");
    },
    async signOut() {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        // sin almacenamiento
      }
      emit("SIGNED_OUT");
    },
    async requestPasswordReset(email) {
      const exists = read<LocalUser[]>(USERS_KEY, []).some((u) => u.email === email.trim().toLowerCase());
      if (exists) write("mgs:local-reset", email.trim().toLowerCase());
      return "Modo demo local: no se envían correos. Si la cuenta existe en este navegador, ya puedes elegir una contraseña nueva.";
    },
    async updatePassword(newPassword) {
      const users = read<LocalUser[]>(USERS_KEY, []);
      const email = session()?.email ?? read<string | null>("mgs:local-reset", null);
      const user = users.find((u) => u.email === email);
      if (!user) throw new DataError("No hay una solicitud de restablecimiento activa.");
      Object.assign(user, await hashPassword(newPassword));
      write(USERS_KEY, users);
      try {
        localStorage.removeItem("mgs:local-reset");
      } catch {
        // sin almacenamiento
      }
    },
  };

  const client: DataClient = {
    mode: "local",
    auth,

    async select<K extends TableName>(table: K, opts: QueryOptions<Row<K>> = {}) {
      let rows = scoped(load(), table, uid()).filter((r) => matches(r, opts as QueryOptions<AnyRow>));
      if (opts.order) {
        const col = opts.order.column as string;
        const dir = opts.order.ascending === false ? -1 : 1;
        rows = rows.sort((a, b) => (a[col] === b[col] ? 0 : (a[col] as string) > (b[col] as string) ? dir : -dir));
      }
      if (opts.limit) rows = rows.slice(0, opts.limit);
      return structuredClone(rows) as unknown as Row<K>[];
    },

    async insert<K extends TableName>(table: K, rows: Partial<Row<K>>[]) {
      const userId = uid();
      const db = load();
      const created = rows.map((r) => withDefaults(table, r as AnyRow, userId));
      db[table] = [...(db[table] ?? []), ...created];
      write(DB_KEY, db);
      return structuredClone(created) as unknown as Row<K>[];
    },

    async upsert<K extends TableName>(table: K, rows: Partial<Row<K>>[], onConflict: (keyof Row<K>)[]) {
      const userId = uid();
      const db = load();
      const all: AnyRow[] = db[table] ?? [];
      const out: AnyRow[] = [];
      for (const r of rows) {
        const candidate = { ...(r as AnyRow), [owner(table)]: userId };
        const idx = all.findIndex((x) => onConflict.every((k) => x[k as string] === candidate[k as string]));
        if (idx >= 0) {
          all[idx] = { ...all[idx], ...candidate, updated_at: new Date().toISOString() };
          out.push(all[idx]);
        } else {
          const created = withDefaults(table, candidate, userId);
          all.push(created);
          out.push(created);
        }
      }
      db[table] = all;
      write(DB_KEY, db);
      return structuredClone(out) as unknown as Row<K>[];
    },

    async update<K extends TableName>(table: K, match: Partial<Row<K>>, patch: Partial<Row<K>>) {
      const userId = uid();
      const db = load();
      const out: AnyRow[] = [];
      db[table] = (db[table] ?? []).map((r) => {
        if (r[owner(table)] !== userId || !matches(r, { eq: match as AnyRow })) return r;
        const next = { ...r, ...(patch as AnyRow), [owner(table)]: userId, updated_at: new Date().toISOString() };
        out.push(next);
        return next;
      });
      write(DB_KEY, db);
      return structuredClone(out) as unknown as Row<K>[];
    },

    async remove<K extends TableName>(table: K, match: Partial<Row<K>>) {
      const userId = uid();
      const db = load();
      const removed = (db[table] ?? []).filter((r) => r[owner(table)] === userId && matches(r, { eq: match as AnyRow }));
      db[table] = (db[table] ?? []).filter((r) => !removed.includes(r));
      // Cascadas equivalentes a las claves foráneas.
      const ids = new Set(removed.map((r) => r.id));
      if (table === "workout_plans") db.workout_exercises = (db.workout_exercises ?? []).filter((r) => !ids.has(r.plan_id));
      if (table === "workout_sessions") db.exercise_sets = (db.exercise_sets ?? []).filter((r) => !ids.has(r.session_id));
      if (table === "chat_conversations") db.chat_messages = (db.chat_messages ?? []).filter((r) => !ids.has(r.conversation_id));
      write(DB_KEY, db);
    },

    async uploadPhoto(path, file) {
      if (!path.startsWith(`${uid()}/`)) throw new DataError("Ruta de foto no permitida.");
      await idb("readwrite", (s) => s.put(file, path));
    },

    async photoUrl(path) {
      if (!path.startsWith(`${uid()}/`)) throw new DataError("Foto no encontrada.");
      const blob = await idb<Blob | undefined>("readonly", (s) => s.get(path) as IDBRequest<Blob | undefined>);
      if (!blob) throw new DataError("Foto no encontrada.");
      return URL.createObjectURL(blob);
    },

    async removePhotos(paths) {
      const userId = uid();
      for (const p of paths) if (p.startsWith(`${userId}/`)) await idb<undefined>("readwrite", (s) => s.delete(p));
    },

    async sendCoachMessage(conversationId, message): Promise<CoachResponse> {
      const userId = uid();
      let convId = conversationId;
      if (!convId) {
        const [conv] = await client.insert("chat_conversations", [{ title: conversationTitle(message) }]);
        convId = conv.id;
      }
      await client.insert("chat_messages", [{ conversation_id: convId, role: "user", content: message, source: "user" }]);

      const db = load();
      const plan = scoped(db, "workout_plans", userId).find((p) => p.is_active) as Row<"workout_plans"> | undefined;
      const today = todayISO();
      const ctx = buildCoachContext({
        profile: scoped(db, "profiles", userId)[0] as unknown as Row<"profiles">,
        settings: scoped(db, "user_settings", userId)[0] as unknown as Row<"user_settings">,
        onboarding: (scoped(db, "onboarding_responses", userId)[0] ?? null) as unknown as Row<"onboarding_responses"> | null,
        goals: scoped(db, "fitness_goals", userId) as unknown as Row<"fitness_goals">[],
        plan: plan ?? null,
        planExercises: plan ? (scoped(db, "workout_exercises", userId).filter((e) => e.plan_id === plan.id) as unknown as Row<"workout_exercises">[]) : [],
        recentSessions: (scoped(db, "workout_sessions", userId) as unknown as Row<"workout_sessions">[]).sort((a, b) => b.started_at.localeCompare(a.started_at)),
        recentSets: scoped(db, "exercise_sets", userId) as unknown as Row<"exercise_sets">[],
        nutrition: (scoped(db, "nutrition_preferences", userId)[0] ?? null) as unknown as Row<"nutrition_preferences"> | null,
        proteinTargetG: null,
        cycleToday: (scoped(db, "cycle_logs", userId).find((c) => c.logged_on === today) ?? null) as unknown as Row<"cycle_logs"> | null,
        todayWeekday: weekdayIndex(today),
        weekStartISO: startOfWeek(today),
        exerciseName: (id) => EXERCISE_BY_ID[id]?.name ?? id,
      });
      const reply = fallbackReply(message, ctx);
      const [saved] = await client.insert("chat_messages", [{ conversation_id: convId, role: "assistant", content: reply.text, source: reply.source }]);
      await client.update("chat_conversations", { id: convId }, {});
      return {
        conversationId: convId,
        message: saved as ChatMessageRow,
        source: reply.source,
        notice: reply.source === "fallback" ? "Modo demo local: respuesta predefinida, no generada por IA." : null,
      };
    },

    async deleteAccount() {
      const userId = uid();
      const photos = (await client.select("progress_photos")).map((p) => p.storage_path);
      await client.removePhotos(photos);
      const db = load();
      for (const t of [...PERSONAL_TABLES, "profiles", "user_settings"] as TableName[]) {
        db[t] = (db[t] ?? []).filter((r) => r[owner(t)] !== userId);
      }
      write(DB_KEY, db);
      write(USERS_KEY, read<LocalUser[]>(USERS_KEY, []).filter((u) => u.id !== userId));
      await auth.signOut();
    },
  };
  return client;
}
