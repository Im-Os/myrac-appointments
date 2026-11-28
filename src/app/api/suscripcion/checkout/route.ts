import { esDuenoDe, supabaseAdmin, usuarioDeLaPeticion } from "@/lib/servidor/supabase-admin";
import { mp } from "@/lib/servidor/mercadopago";
import type { Preapproval } from "@/lib/servidor/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Inicia (o cambia) la suscripción del taller.
 * - Sin suscripción autorizada: crea una en Mercado Pago y devuelve el enlace de pago.
 * - Con suscripción autorizada (cambio mensual ↔ anual): crea la nueva para que empiece al terminar lo pagado;
 *   al autorizarse, la anterior se cancela sola (ver sincronizarPreapproval).
 */
export async function POST(req: Request) {
  try {
    const usuario = await usuarioDeLaPeticion(req);
    if (!usuario) return Response.json({ error: "SIN_SESION" }, { status: 401 });

    const { taller_id, plan_id, payer_email } = (await req.json()) as { taller_id?: string; plan_id?: string; payer_email?: string };
    if (!taller_id || !plan_id) return Response.json({ error: "DATOS_INCOMPLETOS" }, { status: 400 });
    if (!(await esDuenoDe(usuario.id, taller_id))) return Response.json({ error: "SIN_PERMISO" }, { status: 403 });

    const db = supabaseAdmin();
    const [{ data: plan }, { data: taller }, { data: sus }] = await Promise.all([
      db.from("planes").select("id,nombre,precio_mensual,moneda,activo,frecuencia_meses").eq("id", plan_id).maybeSingle(),
      db.from("talleres").select("id,nombre").eq("id", taller_id).maybeSingle(),
      db.from("suscripciones").select("*").eq("taller_id", taller_id).maybeSingle(),
    ]);
    if (!plan?.activo || !(plan.precio_mensual > 0) || !taller) return Response.json({ error: "PLAN_INVALIDO" }, { status: 400 });

    const referencia = `${taller_id}:${plan_id}`;
    const monto = Number(plan.precio_mensual);

    if (sus?.mp_estado === "authorized" && sus.plan_id === plan_id) return Response.json({ error: "YA_SUSCRITO" }, { status: 400 });

    // Si ya paga otro plan (mensual ↔ anual), el nuevo arranca cuando termina lo ya pagado: sin cobro doble.
    // Si sigue en prueba, el primer cobro se hace al terminarla.
    const cambio = sus?.mp_estado === "authorized" && !!sus.mp_preapproval_id;
    const fin = sus?.vence_en ? new Date(sus.vence_en) : null;
    const diferir = (cambio || sus?.estado === "prueba") && fin && fin.getTime() > Date.now() + 3600e3;
    const inicio = diferir ? fin!.toISOString() : undefined;
    const origen = new URL(req.url).origin;

    const p = await mp<Preapproval>("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `MYRAC Appointments · ${plan.nombre} · ${taller.nombre}`,
        external_reference: referencia,
        payer_email: (payer_email || usuario.email || "").trim(),
        back_url: `${origen}/panel/suscripcion?mp=1`,
        status: "pending",
        auto_recurring: {
          frequency: plan.frecuencia_meses ?? 1,
          frequency_type: "months",
          transaction_amount: monto,
          currency_id: plan.moneda ?? "MXN",
          ...(inicio ? { start_date: inicio } : {}),
        },
      }),
    });

    await db.from("suscripciones").upsert(
      {
        taller_id,
        ...(cambio ? { mp_preapproval_nuevo: p.id } : { mp_preapproval_id: p.id, mp_estado: p.status }),
        mp_plan_pendiente: plan_id,
        actualizado_en: new Date().toISOString(),
        ...(sus ? {} : { estado: "vencida" }),
      },
      { onConflict: "taller_id" },
    );

    return Response.json({ init_point: p.init_point });
  } catch (e) {
    console.error("[checkout]", e);
    return Response.json({ error: e instanceof Error ? e.message : "ERROR" }, { status: 500 });
  }
}
