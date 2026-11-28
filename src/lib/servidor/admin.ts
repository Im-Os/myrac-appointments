import "server-only";
import { supabaseAdmin, usuarioDeLaPeticion } from "./supabase-admin";

/** Devuelve el admin que hace la petición o null si no es admin de la plataforma. */
export async function exigirAdmin(req: Request): Promise<{ id: string; email: string | null } | null> {
  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return null;
  const { data } = await supabaseAdmin().from("plataforma_admins").select("auth_user_id").eq("auth_user_id", usuario.id).maybeSingle();
  return data ? usuario : null;
}

export async function bitacora(adminId: string, accion: string, tallerId: string | null, detalle?: Record<string, unknown>) {
  await supabaseAdmin().from("admin_bitacora").insert({ admin_id: adminId, accion, taller_id: tallerId, detalle: detalle ?? null });
}

export function codigoAlta(prefijo: string) {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bloque = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => letras[b % letras.length]).join("");
  const p = prefijo
    .normalize("NFD")
    .replace(/[^\w]/g, "")
    .toUpperCase()
    .slice(0, 6) || "TALLER";
  return `${p}-${bloque()}-${bloque()}`;
}
