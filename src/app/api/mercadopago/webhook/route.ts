import { firmaValida, registrarCobro, sincronizarPreapproval } from "@/lib/servidor/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Notificaciones de Mercado Pago ("Planes y suscripciones").
 * No se confía en el contenido del aviso: se vuelve a consultar el recurso a Mercado Pago.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const cuerpo = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const tipo = cuerpo.type ?? cuerpo.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = String(cuerpo.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!id) return new Response("ok", { status: 200 });

  const firma = firmaValida(req, url.searchParams.get("data.id") ?? id);
  if (firma === false) console.warn("[webhook] firma no coincide; se procesa consultando a Mercado Pago", { tipo, id });

  try {
    if (tipo === "subscription_preapproval" || tipo === "preapproval") await sincronizarPreapproval(id);
    else if (tipo === "subscription_authorized_payment" || tipo === "authorized_payment") await registrarCobro(id);
  } catch (e) {
    console.error("[webhook]", tipo, id, e);
    // 500 para que Mercado Pago reintente más tarde.
    return new Response("error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}

export async function GET() {
  return new Response("ok", { status: 200 });
}
