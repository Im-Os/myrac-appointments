import { bitacora, codigoAlta, exigirAdmin } from "@/lib/servidor/admin";
import { supabaseAdmin } from "@/lib/servidor/supabase-admin";
import { sincronizarPreapproval } from "@/lib/servidor/mercadopago";

export const dynamic = "force-dynamic";

type Cuerpo = {
  accion:
    | "extender_prueba"
    | "cortesia"
    | "pausar"
    | "fundador"
    | "codigo_alta"
    | "crear_taller"
    | "agregar_admin"
    | "quitar_admin"
    | "sincronizar";
  taller_id?: string;
  dias?: number;
  hasta?: string | null;
  valor?: boolean;
  rol?: "dueno" | "recepcion" | "mecanico";
  nombre?: string;
  slug?: string;
  email?: string;
  user_id?: string;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function POST(req: Request) {
  const admin = await exigirAdmin(req);
  if (!admin) return Response.json({ error: "SIN_PERMISO" }, { status: 403 });
  const c = (await req.json().catch(() => ({}))) as Cuerpo;
  const db = supabaseAdmin();
  const ahora = new Date();

  try {
    switch (c.accion) {
      case "extender_prueba": {
        const dias = Math.max(1, Math.min(365, Number(c.dias) || 0));
        const { data: s } = await db.from("suscripciones").select("estado,vence_en").eq("taller_id", c.taller_id).maybeSingle();
        const base = s?.vence_en && new Date(s.vence_en) > ahora ? new Date(s.vence_en) : ahora;
        const vence = new Date(base.getTime() + dias * 86400e3).toISOString();
        await db.from("suscripciones").upsert({ taller_id: c.taller_id, estado: s?.estado === "activa" ? "activa" : "prueba", vence_en: vence }, { onConflict: "taller_id" });
        await bitacora(admin.id, "extender_prueba", c.taller_id!, { dias, vence });
        return Response.json({ ok: true, vence });
      }
      case "cortesia": {
        // Activa el servicio sin cobro (pilotos, aliados). hasta = null → sin vencimiento.
        const vence = c.hasta ? new Date(`${c.hasta}T23:59:59-06:00`).toISOString() : null;
        await db.from("suscripciones").upsert({ taller_id: c.taller_id, estado: "activa", plan_id: "basico", vence_en: vence }, { onConflict: "taller_id" });
        await bitacora(admin.id, "cortesia", c.taller_id!, { hasta: c.hasta ?? "sin vencimiento" });
        return Response.json({ ok: true });
      }
      case "pausar": {
        await db.from("suscripciones").upsert({ taller_id: c.taller_id, estado: "vencida", vence_en: ahora.toISOString() }, { onConflict: "taller_id" });
        await bitacora(admin.id, "pausar", c.taller_id!);
        return Response.json({ ok: true });
      }
      case "fundador": {
        if (c.valor) {
          const { count } = await db.from("suscripciones").select("taller_id", { count: "exact", head: true }).eq("fundador", true);
          if ((count ?? 0) >= 15) return Response.json({ error: "Ya están ocupados los 15 lugares de fundador." }, { status: 400 });
        }
        await db.from("suscripciones").update({ fundador: !!c.valor }).eq("taller_id", c.taller_id);
        await bitacora(admin.id, c.valor ? "fundador_si" : "fundador_no", c.taller_id!);
        return Response.json({ ok: true });
      }
      case "codigo_alta": {
        const { data: t } = await db.from("talleres").select("nombre").eq("id", c.taller_id).maybeSingle();
        if (!t) return Response.json({ error: "Taller no encontrado." }, { status: 404 });
        const codigo = codigoAlta(t.nombre);
        const { error } = await db.from("codigos_alta").insert({ codigo, taller_id: c.taller_id, rol: c.rol ?? "dueno" });
        if (error) throw error;
        await bitacora(admin.id, "codigo_alta", c.taller_id!, { rol: c.rol ?? "dueno" });
        return Response.json({ ok: true, codigo });
      }
      case "crear_taller": {
        // Taller precargado (sin dueño todavía) + código para que el dueño lo reclame.
        const nombre = (c.nombre ?? "").trim();
        const slug = (c.slug ?? "").trim().toLowerCase();
        if (nombre.length < 2 || !SLUG.test(slug)) return Response.json({ error: "Revisa el nombre y la dirección (solo minúsculas, números y guiones)." }, { status: 400 });
        const { data: t, error } = await db.from("talleres").insert({ nombre, slug }).select("id").single();
        if (error) return Response.json({ error: error.message.includes("duplicate") ? "Esa dirección ya está en uso." : error.message.includes("reservado") ? "Esa dirección está reservada." : error.message }, { status: 400 });
        await db.from("horario_taller").insert(
          [1, 2, 3, 4, 5, 6].map((d) => ({ taller_id: t.id, dia_semana: d, abre: "09:00", cierra: d === 6 ? "14:00" : "18:00" })),
        );
        await db.rpc("aplicar_plantilla_servicios", { p_taller_id: t.id });
        await db.from("suscripciones").insert({ taller_id: t.id, estado: "prueba", vence_en: new Date(ahora.getTime() + 30 * 86400e3).toISOString() });
        const codigo = codigoAlta(nombre);
        await db.from("codigos_alta").insert({ codigo, taller_id: t.id, rol: "dueno" });
        await bitacora(admin.id, "crear_taller", t.id, { nombre, slug });
        return Response.json({ ok: true, taller_id: t.id, codigo });
      }
      case "agregar_admin": {
        const { data: uid } = await db.rpc("admin_buscar_usuario", { p_email: c.email ?? "" });
        if (!uid) return Response.json({ error: "Esa persona aún no tiene cuenta en la app." }, { status: 400 });
        await db.from("plataforma_admins").upsert({ auth_user_id: uid });
        await bitacora(admin.id, "agregar_admin", null, { email: c.email });
        return Response.json({ ok: true });
      }
      case "quitar_admin": {
        if (c.user_id === admin.id) return Response.json({ error: "No puedes quitarte a ti mismo." }, { status: 400 });
        await db.from("plataforma_admins").delete().eq("auth_user_id", c.user_id);
        await bitacora(admin.id, "quitar_admin", null, { user_id: c.user_id });
        return Response.json({ ok: true });
      }
      case "sincronizar": {
        const { data: s } = await db.from("suscripciones").select("mp_preapproval_id,mp_preapproval_nuevo").eq("taller_id", c.taller_id).maybeSingle();
        const id = s?.mp_preapproval_nuevo ?? s?.mp_preapproval_id;
        if (!id) return Response.json({ error: "Este taller no tiene suscripción en Mercado Pago." }, { status: 400 });
        const p = await sincronizarPreapproval(id);
        return Response.json({ ok: true, estado: p.status });
      }
      default:
        return Response.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    console.error("[admin]", c.accion, e);
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
