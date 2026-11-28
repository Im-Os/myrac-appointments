"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { Aviso, Cargando, EncabezadoPagina, Insignia, Tarjeta, Vacio, cx } from "@/components/ui";
import { diaClave, fechaLarga } from "@/lib/fechas";
import { supabase } from "@/lib/supabase";

type Suscripcion = { plan_id: string | null; estado: "prueba" | "activa" | "vencida" | "cancelada"; vence_en: string | null };
type Plan = { id: string; nombre: string; precio_mensual: number; moneda: string };

const BENEFICIOS: Record<string, string[]> = {
  basico: ["Página de citas con tu marca", "Agenda y confirmaciones", "Tablero de bahías", "Equipo ilimitado"],
  pro: ["Todo lo de Citas", "Operación del taller (próximamente)", "Integración con MYRAC OS", "Soporte prioritario"],
};

export default function SuscripcionPagina() {
  const { taller, esDueno } = usePanel();
  const [sus, setSus] = useState<Suscripcion | null | undefined>(undefined);
  const [planes, setPlanes] = useState<Plan[]>([]);

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from("suscripciones").select("plan_id,estado,vence_en").eq("taller_id", taller.id).maybeSingle(),
      sb.from("planes").select("id,nombre,precio_mensual,moneda").order("precio_mensual"),
    ]).then(([s, p]) => {
      setSus((s.data as Suscripcion) ?? null);
      setPlanes((p.data ?? []) as Plan[]);
    });
  }, [taller.id]);

  if (!esDueno) return <Vacio titulo="Solo el dueño puede ver la suscripción" />;
  if (sus === undefined) return <Cargando />;

  const vigente = sus && (sus.estado === "prueba" || sus.estado === "activa") && (!sus.vence_en || new Date(sus.vence_en) > new Date());
  const diasRestantes = sus?.vence_en ? Math.max(0, Math.ceil((new Date(sus.vence_en).getTime() - Date.now()) / 86400e3)) : null;

  return (
    <div className="max-w-4xl">
      <EncabezadoPagina titulo="Suscripción" />

      <Tarjeta className="mb-8 flex flex-wrap items-center gap-4 p-5">
        <div className={cx("grid size-12 place-items-center rounded-2xl", vigente ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          <Sparkles className="size-6" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">
              {sus?.estado === "prueba" ? "Periodo de prueba" : sus?.estado === "activa" ? `Plan ${planes.find((p) => p.id === sus.plan_id)?.nombre ?? "activo"}` : "Sin suscripción vigente"}
            </p>
            <Insignia className={vigente ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}>
              {vigente ? "Recibiendo citas" : "Citas en línea pausadas"}
            </Insignia>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {sus?.vence_en
              ? `${vigente ? "Vence" : "Venció"} el ${fechaLarga(diaClave(sus.vence_en, taller.zona_horaria))}${vigente && diasRestantes !== null ? ` · quedan ${diasRestantes} días` : ""}`
              : vigente
                ? "Sin fecha de vencimiento."
                : ""}
          </p>
        </div>
      </Tarjeta>

      <h2 className="mb-3 font-semibold">Planes</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {planes.map((p) => (
          <Tarjeta key={p.id} className={cx("p-6", sus?.plan_id === p.id && "ring-2 ring-brand")}>
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{p.nombre}</p>
              {sus?.plan_id === p.id && <Insignia className="bg-brand text-brand-ink ring-brand">Tu plan</Insignia>}
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {p.precio_mensual > 0 ? `$${p.precio_mensual.toLocaleString("es-MX")}` : "Precio por definir"}
              {p.precio_mensual > 0 && <span className="text-base font-normal text-muted"> {p.moneda}/mes</span>}
            </p>
            <ul className="mt-5 space-y-2 text-[15px]">
              {(BENEFICIOS[p.id] ?? []).map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {b}
                </li>
              ))}
            </ul>
          </Tarjeta>
        ))}
      </div>
      <Aviso tono="info" className="mt-6">
        El pago en línea con tarjeta se activará muy pronto. Mientras tanto, si tu periodo de prueba está por vencer, contáctanos para mantener tus citas activas.
      </Aviso>
    </div>
  );
}
