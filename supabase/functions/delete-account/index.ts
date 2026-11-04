// Edge Function: borra la cuenta del usuario autenticado y todos sus datos.
// Las tablas se borran en cascada desde auth.users; las fotos del bucket privado se eliminan aquí.
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autenticado." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await userDb.auth.getUser();
  if (error || !data.user) return json({ error: "Sesión inválida." }, 401);

  let confirm: unknown = null;
  try {
    confirm = (await req.json())?.confirm;
  } catch {
    // cuerpo vacío
  }
  if (confirm !== "BORRAR") return json({ error: "Confirmación requerida." }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userId = data.user.id;
  // Fotos de progreso, adjuntos y audios del coach, y fotos del clóset (incluidas las subcarpetas).
  for (const bucket of ["progress-photos", "chat-attachments", "wardrobe"]) {
    const paths = await listAll(admin, bucket, userId);
    for (let i = 0; i < paths.length; i += 100) await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: "No se pudo borrar la cuenta." }, 500);
  return json({ ok: true });
});

/** Rutas de todos los archivos bajo una carpeta del bucket, recorriendo subcarpetas. */
// deno-lint-ignore no-explicit-any
async function listAll(admin: any, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const f of (data ?? []) as { name: string; id: string | null }[]) {
    const path = `${prefix}/${f.name}`;
    if (f.id) out.push(path);
    else if (depth < 3) out.push(...await listAll(admin, bucket, path, depth + 1));
  }
  return out;
}
