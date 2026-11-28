import { esDuenoDe, supabaseAdmin, usuarioDeLaPeticion } from "@/lib/servidor/supabase-admin";
import { mp, sincronizarPreapproval } from "@/lib/servidor/mercadopago";
import type { Preapproval } from "@/lib/servidor/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Inicia (o cambia) la suscripción del taller.
 * - Sin suscripción autorizada: crea una en Mercado Pago y devuelve el enlace de pago.
 * - Con suscripción autorizada: cambia el monto al nuevo plan (sin volver a pedir tarjeta).
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
      db.from("planes").select("id,nombre,precio_mensual,moneda,activo").eq("id", plan_id).maybeSingle(),
      db.from("talleres").select("id,nombre").eq("id", taller_id).maybeSingle(),
      db.from("suscripciones").select("*").eq("taller_id", taller_id).maybeSingle(),
    ]);
    if (!plan?.activo || !(plan.precio_mensual > 0) || !taller) return Response.json({ error: "PLAN_INVALIDO" }, { status: 400 });

    const referencia = `${taller_id}:${plan_id}`;
    const monto = Number(plan.precio_mensual);

    // Cambio de plan sobre una suscripción ya autorizada.
    if (sus?.mp_preapproval_id && sus.mp_estado === "authorized") {
      await mp(`/preapproval/${sus.mp_preapproval_id}`, {
        method: "PUT",
        body: JSON.stringify({
          reason: `MYRAC Appointments · ${plan.nombre} · ${taller.nombre}`,
          external_reference: referencia,
          auto_recurring: { transaction_amount: monto, currency_id: plan.moneda ?? "MXN" },
        }),
      });
      await sincronizarPreapproval(sus.mp_preapproval_id);
      return Response.json({ cambiado: true });
    }

    // Nueva suscripción. Si el taller sigue en prueba, el primer cobro se hace al terminarla.
    const finPrueba = sus?.estado === "prueba" && sus.vence_en ? new Date(sus.vence_en) : null;
    const inicio = finPrueba && finPrueba.getTime() > Date.now() + 3600e3 ? finPrueba.toISOString() : undefined;
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
          frequency: 1,
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
        mp_preapproval_id: p.id,
        mp_estado: p.status,
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
