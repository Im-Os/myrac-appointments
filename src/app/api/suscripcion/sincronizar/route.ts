import { esDuenoDe, supabaseAdmin, usuarioDeLaPeticion } from "@/lib/servidor/supabase-admin";
import { sincronizarPreapproval } from "@/lib/servidor/mercadopago";

export const dynamic = "force-dynamic";

/** Al volver del checkout: consulta el estado en Mercado Pago sin esperar al webhook. */
export async function POST(req: Request) {
  try {
    const usuario = await usuarioDeLaPeticion(req);
    if (!usuario) return Response.json({ error: "SIN_SESION" }, { status: 401 });
    const { taller_id } = (await req.json()) as { taller_id?: string };
    if (!taller_id || !(await esDuenoDe(usuario.id, taller_id))) return Response.json({ error: "SIN_PERMISO" }, { status: 403 });

    const { data: sus } = await supabaseAdmin().from("suscripciones").select("mp_preapproval_id").eq("taller_id", taller_id).maybeSingle();
    if (!sus?.mp_preapproval_id) return Response.json({ estado: null });
    const p = await sincronizarPreapproval(sus.mp_preapproval_id);
    return Response.json({ estado: p.status });
  } catch (e) {
    console.error("[sincronizar]", e);
    return Response.json({ error: e instanceof Error ? e.message : "ERROR" }, { status: 500 });
  }
}
