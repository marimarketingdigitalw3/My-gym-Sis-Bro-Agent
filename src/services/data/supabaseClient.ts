// Implementación real sobre Supabase (Auth, PostgreSQL con RLS, Storage y Edge Functions).
import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import type { TableName } from "@/types/db";
import { DataError, type AuthService, type CoachResponse, type DataClient, type QueryOptions, type Row } from "./types";

const PHOTO_BUCKET = "progress-photos";

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  throw new DataError(error?.message || fallback, error?.code);
}

export function createSupabaseDataClient(url: string, anonKey: string): DataClient {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  async function currentUserId(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new DataError("Tu sesión expiró. Vuelve a iniciar sesión.", "unauthenticated", 401);
    return id;
  }

  const ownerColumn = (table: TableName) => (table === "profiles" ? "id" : "user_id");

  const auth: AuthService = {
    async getUser() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? "" } : null;
    },
    onChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        cb(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null, event);
      });
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password, displayName) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) fail(error, "No se pudo crear la cuenta.");
      return { needsEmailVerification: !data.session };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = /confirm/i.test(error.message)
          ? "Confirma tu correo antes de iniciar sesión."
          : "Correo o contraseña incorrectos.";
        throw new DataError(msg, error.code);
      }
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async requestPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) fail(error, "No se pudo enviar el correo.");
      return "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.";
    },
    async updatePassword(newPassword) {
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) fail(error, "No se pudo actualizar la contraseña.");
    },
  };

  return {
    mode: "supabase",
    auth,

    async select<K extends TableName>(table: K, opts: QueryOptions<Row<K>> = {}) {
      let q = sb.from(table).select("*");
      for (const [k, v] of Object.entries(opts.eq ?? {})) q = q.eq(k, v as never);
      for (const [k, v] of Object.entries(opts.gte ?? {})) q = q.gte(k, v as never);
      for (const [k, v] of Object.entries(opts.lte ?? {})) q = q.lte(k, v as never);
      if (opts.in) q = q.in(String(opts.in.column), opts.in.values);
      if (opts.order) q = q.order(String(opts.order.column), { ascending: opts.order.ascending ?? true });
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) fail(error, "No se pudieron cargar los datos.");
      return (data ?? []) as Row<K>[];
    },

    async insert<K extends TableName>(table: K, rows: Partial<Row<K>>[]) {
      const uid = await currentUserId();
      const payload = rows.map((r) => ({ ...r, [ownerColumn(table)]: uid }));
      const { data, error } = await sb.from(table).insert(payload).select();
      if (error) fail(error, "No se pudo guardar.");
      return (data ?? []) as Row<K>[];
    },

    async upsert<K extends TableName>(table: K, rows: Partial<Row<K>>[], onConflict: (keyof Row<K>)[]) {
      const uid = await currentUserId();
      const payload = rows.map((r) => ({ ...r, [ownerColumn(table)]: uid }));
      const { data, error } = await sb.from(table).upsert(payload, { onConflict: onConflict.join(",") }).select();
      if (error) fail(error, "No se pudo guardar.");
      return (data ?? []) as Row<K>[];
    },

    async update<K extends TableName>(table: K, match: Partial<Row<K>>, patch: Partial<Row<K>>) {
      let q = sb.from(table).update(patch);
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never);
      const { data, error } = await q.select();
      if (error) fail(error, "No se pudo actualizar.");
      return (data ?? []) as Row<K>[];
    },

    async remove<K extends TableName>(table: K, match: Partial<Row<K>>) {
      const uid = await currentUserId();
      let q = sb.from(table).delete().eq(ownerColumn(table), uid);
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never);
      const { error } = await q;
      if (error) fail(error, "No se pudo borrar.");
    },

    async uploadPhoto(path, file) {
      const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
      if (error) fail(error, "No se pudo subir la foto.");
    },

    async photoUrl(path) {
      const { data, error } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 10);
      if (error || !data) fail(error, "No se pudo abrir la foto.");
      return data.signedUrl;
    },

    async removePhotos(paths) {
      if (!paths.length) return;
      const { error } = await sb.storage.from(PHOTO_BUCKET).remove(paths);
      if (error) fail(error, "No se pudo borrar la foto.");
    },

    async sendCoachMessage(conversationId, message): Promise<CoachResponse> {
      const { data, error } = await sb.functions.invoke("coach-chat", { body: { conversationId, message } });
      if (error) {
        let detail = "El coach no está disponible en este momento.";
        let status: number | undefined;
        if (error instanceof FunctionsHttpError) {
          status = error.context.status;
          try {
            detail = (await error.context.json()).error ?? detail;
          } catch {
            // respuesta sin JSON
          }
        }
        throw new DataError(detail, "coach_error", status);
      }
      return data as CoachResponse;
    },

    async deleteAccount() {
      const { error } = await sb.functions.invoke("delete-account", { body: { confirm: "BORRAR" } });
      if (error) throw new DataError("No se pudo borrar la cuenta. Inténtalo de nuevo.");
      await sb.auth.signOut();
    },
  };
}
