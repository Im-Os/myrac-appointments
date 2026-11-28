import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase-admin";

const API = "https://api.mercadopago.com";
const GRACIA_DIAS = 3; // días extra tras la fecha de cobro por si Mercado Pago reintenta

export type Preapproval = {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  external_reference?: string;
  payer_email?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
};

function token() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN en el servidor");
  return t;
}

export async function mp<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (cuerpo as { message?: string }).message ?? `HTTP ${r.status}`;
    throw new Error(`Mercado Pago: ${msg}`);
  }
  return cuerpo as T;
}

/**
 * Verifica la firma x-signature de una notificación (HMAC-SHA256 del manifiesto
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"). Es una capa extra: el estado
 * real siempre se vuelve a consultar a Mercado Pago con nuestra llave.
 */
export function firmaValida(req: Request, dataId: string): boolean | null {
  const secreto = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secreto) return null;
  const firma = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(firma.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifiesto = `id:${id};`;
  if (requestId) manifiesto += `request-id:${requestId};`;
  manifiesto += `ts:${partes.ts};`;
  const esperado = createHmac("sha256", secreto).update(manifiesto).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
  } catch {
    return false;
  }
}

function conGracia(fecha: string | undefined | null): string {
  const base = fecha ? new Date(fecha) : new Date(Date.now() + 31 * 86400e3);
  return new Date(base.getTime() + GRACIA_DIAS * 86400e3).toISOString();
}

/** Lee la suscripción en Mercado Pago y deja la base de datos igual. Fuente de verdad: Mercado Pago. */
export async function sincronizarPreapproval(preapprovalId: string): Promise<Preapproval> {
  const p = await mp<Preapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  const [tallerId, planId] = (p.external_reference ?? "").split(":");
  if (!tallerId) throw new Error("Suscripción sin referencia de taller");

  const db = supabaseAdmin();
  const { data: actual } = await db.from("suscripciones").select("*").eq("taller_id", tallerId).maybeSingle();
  const cambios: Record<string, unknown> = { mp_preapproval_id: p.id, mp_estado: p.status, actualizado_en: new Date().toISOString() };

  // Solo se acepta la suscripción que el taller inició desde la app.
  if (actual?.mp_preapproval_id && actual.mp_preapproval_id !== p.id) {
    // Cambio de plan: la nueva quedó autorizada → se cancela la anterior para no cobrar doble.
    if (actual.mp_preapproval_nuevo === p.id && p.status === "authorized") {
      await mp(`/preapproval/${actual.mp_preapproval_id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }).catch((e) =>
        console.error("[mp] no se pudo cancelar la suscripción anterior", e),
      );
      cambios.mp_preapproval_nuevo = null;
    } else {
      return p;
    }
  }

  if (p.status === "authorized") {
    cambios.estado = "activa";
    cambios.plan_id = planId || actual?.mp_plan_pendiente || actual?.plan_id;
    cambios.mp_plan_pendiente = null;
    // Precio fundador: los primeros 15 talleres en suscribirse conservan su precio.
    if (!actual?.fundador) {
      const { count } = await db.from("suscripciones").select("taller_id", { count: "exact", head: true }).eq("fundador", true);
      if ((count ?? 0) < 15) cambios.fundador = true;
    }
    // Si aún tiene prueba, conserva lo que sea más largo.
    const nuevo = conGracia(p.next_payment_date);
    cambios.vence_en = actual?.vence_en && new Date(actual.vence_en) > new Date(nuevo) ? actual.vence_en : nuevo;
  }
  // En pausa o cancelada: no se corta de golpe, sigue activa hasta que termina lo ya pagado (vence_en).
  await db.from("suscripciones").upsert({ taller_id: tallerId, ...cambios }, { onConflict: "taller_id" });
  return p;
}

type CobroAutorizado = {
  id: number | string;
  preapproval_id: string;
  transaction_amount?: number;
  currency_id?: string;
  status?: string;
  date_created?: string;
  payment?: { status?: string };
};

export async function registrarCobro(cobroId: string) {
  const c = await mp<CobroAutorizado>(`/authorized_payments/${encodeURIComponent(cobroId)}`);
  const p = await sincronizarPreapproval(c.preapproval_id);
  const tallerId = (p.external_reference ?? "").split(":")[0];
  const estado = c.payment?.status ?? c.status ?? null;
  const db = supabaseAdmin();
  await db.from("pagos_suscripcion").upsert({
    id: String(c.id),
    taller_id: tallerId,
    monto: c.transaction_amount ?? null,
    moneda: c.currency_id ?? null,
    estado,
    fecha: c.date_created ?? new Date().toISOString(),
  });
  if (estado === "approved") {
    await db
      .from("suscripciones")
      .update({ estado: "activa", vence_en: conGracia(p.next_payment_date), actualizado_en: new Date().toISOString() })
      .eq("taller_id", tallerId);
  }
}
