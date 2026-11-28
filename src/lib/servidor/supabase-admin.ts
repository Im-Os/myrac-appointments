import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Cliente con la llave secreta: solo en el servidor, se salta RLS. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY?.trim();
    if (!url || !key) throw new Error("Falta SUPABASE_SECRET_KEY en el servidor");
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

/** Valida el token del usuario que llama a la API y devuelve su id y correo. */
export async function usuarioDeLaPeticion(req: Request): Promise<{ id: string; email: string | null } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) {
    if (error) console.error("[auth] no se pudo validar la sesión:", error.message);
    return null;
  }
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function esDuenoDe(userId: string, tallerId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("usuarios_taller")
    .select("rol")
    .eq("taller_id", tallerId)
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data?.rol === "dueno";
}
