import { supabaseAdmin } from "@/lib/servidor/supabase-admin";

export const dynamic = "force-dynamic";

/** Diagnóstico de configuración: dice qué llaves hay y si funcionan, nunca su valor. */
export async function GET() {
  const hay = (k: string) => Boolean(process.env[k]?.trim());
  const estado: Record<string, unknown> = {
    supabase_secret_key: hay("SUPABASE_SECRET_KEY"),
    supabase_secret_formato: process.env.SUPABASE_SECRET_KEY?.trim().startsWith("sb_secret_") ?? false,
    supabase_secret_espacios: process.env.SUPABASE_SECRET_KEY ? process.env.SUPABASE_SECRET_KEY !== process.env.SUPABASE_SECRET_KEY.trim() : false,
    mercadopago_access_token: hay("MERCADOPAGO_ACCESS_TOKEN"),
    mercadopago_tipo: process.env.MERCADOPAGO_ACCESS_TOKEN?.trim().startsWith("TEST-") ? "prueba" : process.env.MERCADOPAGO_ACCESS_TOKEN?.trim().startsWith("APP_USR-") ? "produccion" : "desconocido",
    mercadopago_webhook_secret: hay("MERCADOPAGO_WEBHOOK_SECRET"),
    correo: hay("RESEND_API_KEY") && hay("AVISOS_REMITENTE"),
  };
  try {
    const { error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1 });
    estado.supabase_funciona = !error;
    if (error) estado.supabase_error = error.message;
  } catch (e) {
    estado.supabase_funciona = false;
    estado.supabase_error = e instanceof Error ? e.message : String(e);
  }
  if (estado.mercadopago_access_token) {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN!.trim()}` },
      cache: "no-store",
    }).catch(() => null);
    estado.mercadopago_funciona = r?.ok ?? false;
  }
  return Response.json(estado);
}
