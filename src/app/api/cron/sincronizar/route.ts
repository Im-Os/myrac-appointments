import { supabaseAdmin } from "@/lib/servidor/supabase-admin";
import { mp, registrarCobro, sincronizarPreapproval } from "@/lib/servidor/mercadopago";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Busqueda = { results?: { id: number | string; status?: string; payment?: { status?: string } }[] };

/**
 * Revisión diaria (Vercel Cron): vuelve a consultar en Mercado Pago cada suscripción
 * y registra los cobros, por si algún aviso (webhook) no llegó. Es idempotente.
 * Si existe CRON_SECRET, solo Vercel Cron puede llamarla.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET?.trim();
  if (secreto && req.headers.get("authorization") !== `Bearer ${secreto}`) return new Response("no autorizado", { status: 401 });
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return Response.json({ omitido: "sin MERCADOPAGO_ACCESS_TOKEN" });

  const db = supabaseAdmin();
  // Freno: sin CRON_SECRET cualquiera podría llamarla; como máximo corre una vez cada 6 horas.
  const { data: ultima } = await db.from("tareas_programadas").select("ultima").eq("nombre", "sincronizar").maybeSingle();
  if (ultima && Date.now() - new Date(ultima.ultima).getTime() < 6 * 3600e3) return Response.json({ omitido: "ya corrió hace poco" });
  await db.from("tareas_programadas").upsert({ nombre: "sincronizar", ultima: new Date().toISOString() });

  const { data } = await db
    .from("suscripciones")
    .select("taller_id,mp_preapproval_id,mp_preapproval_nuevo,mp_estado")
    .or("mp_preapproval_id.not.is.null,mp_preapproval_nuevo.not.is.null");

  const resultado = { revisadas: 0, cobros: 0, errores: 0 };
  for (const s of data ?? []) {
    for (const id of [s.mp_preapproval_nuevo, s.mp_preapproval_id].filter(Boolean) as string[]) {
      try {
        const p = await sincronizarPreapproval(id);
        resultado.revisadas++;
        if (p.status === "authorized" || p.status === "cancelled" || p.status === "paused") {
          const b = await mp<Busqueda>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(id)}&limit=20`);
          for (const cobro of b.results ?? []) {
            await registrarCobro(String(cobro.id));
            resultado.cobros++;
          }
        }
      } catch (e) {
        resultado.errores++;
        console.error("[cron]", s.taller_id, id, e);
      }
    }
  }
  return Response.json(resultado);
}
