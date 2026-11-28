import { exigirAdmin } from "@/lib/servidor/admin";
import { supabaseAdmin } from "@/lib/servidor/supabase-admin";

export const dynamic = "force-dynamic";

type FilaTaller = {
  id: string;
  estado: string | null;
  plan_id: string | null;
  vence_en: string | null;
  mp_estado: string | null;
  fundador: boolean;
  creado_en: string;
  citas_30d: number;
};

/** Todo lo que necesita el panel de administración en una sola llamada. */
export async function GET(req: Request) {
  const admin = await exigirAdmin(req);
  if (!admin) return Response.json({ error: "SIN_PERMISO" }, { status: 403 });

  const db = supabaseAdmin();
  const [t, p, pl, a, b, lf] = await Promise.all([
    db.rpc("admin_talleres"),
    db.from("pagos_suscripcion").select("id,taller_id,monto,moneda,estado,fecha").order("fecha", { ascending: false }).limit(50),
    db.from("planes").select("id,nombre,precio_mensual,frecuencia_meses,activo"),
    db.rpc("admin_lista_admins"),
    db.from("admin_bitacora").select("id,admin_id,accion,taller_id,detalle,creado_en").order("creado_en", { ascending: false }).limit(30),
    db.rpc("lugares_fundador"),
  ]);
  if (t.error) return Response.json({ error: t.error.message }, { status: 500 });

  const talleres = (t.data ?? []) as FilaTaller[];
  const planes = (pl.data ?? []) as { id: string; precio_mensual: number; frecuencia_meses: number }[];
  const ahora = Date.now();
  const vigente = (x: FilaTaller) => (x.estado === "prueba" || x.estado === "activa") && (!x.vence_en || new Date(x.vence_en).getTime() > ahora);
  const pagando = talleres.filter((x) => x.mp_estado === "authorized" && vigente(x));
  const mensual = (planId: string | null) => {
    const plan = planes.find((q) => q.id === planId);
    return plan ? Number(plan.precio_mensual) / (plan.frecuencia_meses || 1) : 0;
  };

  const metricas = {
    talleres: talleres.length,
    en_prueba: talleres.filter((x) => x.estado === "prueba" && vigente(x)).length,
    pagando: pagando.length,
    cortesia: talleres.filter((x) => x.estado === "activa" && x.mp_estado !== "authorized" && vigente(x)).length,
    pausados: talleres.filter((x) => !vigente(x)).length,
    fundadores: talleres.filter((x) => x.fundador).length,
    ingreso_mensual: Math.round(pagando.reduce((s, x) => s + mensual(x.plan_id), 0)),
    citas_30d: talleres.reduce((s, x) => s + (x.citas_30d ?? 0), 0),
    nuevos_7d: talleres.filter((x) => ahora - new Date(x.creado_en).getTime() < 7 * 86400e3).length,
  };

  return Response.json({
    yo: admin,
    metricas,
    lugares_fundador: lf.data ?? null,
    talleres,
    pagos: p.data ?? [],
    planes: pl.data ?? [],
    admins: a.data ?? [],
    bitacora: b.data ?? [],
  });
}
