"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Entrada, Insignia, Modal, Tarjeta, Vacio, cx, useAvisos } from "@/components/ui";
import { diaClave, fechaLarga } from "@/lib/fechas";
import { supabase } from "@/lib/supabase";

type Suscripcion = {
  plan_id: string | null;
  estado: "prueba" | "activa" | "vencida" | "cancelada";
  vence_en: string | null;
  mp_preapproval_id: string | null;
  mp_estado: "pending" | "authorized" | "paused" | "cancelled" | null;
  mp_plan_pendiente: string | null;
};
type Plan = { id: string; nombre: string; precio_mensual: number; moneda: string };
type Pago = { id: string; monto: number | null; moneda: string | null; estado: string | null; fecha: string | null };

const BENEFICIOS: Record<string, string[]> = {
  basico: ["Página de citas con tu marca y QR", "Agenda, confirmaciones y tiempo real", "Tablero de bahías", "Equipo ilimitado"],
  pro: ["Todo lo de Citas", "Operación del taller (próximamente)", "Integración con MYRAC OS", "Soporte prioritario"],
};

const MENSAJES_API: Record<string, string> = {
  SIN_SESION: "Tu sesión terminó. Vuelve a entrar.",
  SIN_PERMISO: "Solo el dueño puede cambiar la suscripción.",
  PLAN_INVALIDO: "Ese plan no está disponible.",
  SIN_SUSCRIPCION: "No hay una suscripción activa con Mercado Pago.",
};

async function api(ruta: string, cuerpo: object) {
  const { data } = await supabase().auth.getSession();
  const r = await fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = String(j.error ?? "");
    throw new Error(MENSAJES_API[e] ?? (e.startsWith("Mercado Pago") ? e : "No se pudo completar. Inténtalo de nuevo."));
  }
  return j;
}

export default function SuscripcionPagina() {
  const { taller, esDueno, usuario } = usePanel();
  const avisar = useAvisos();
  const [sus, setSus] = useState<Suscripcion | null | undefined>(undefined);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [correo, setCorreo] = useState(usuario.email ?? "");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [cancelar, setCancelar] = useState(false);

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [s, p, h] = await Promise.all([
      sb.from("suscripciones").select("plan_id,estado,vence_en,mp_preapproval_id,mp_estado,mp_plan_pendiente").eq("taller_id", taller.id).maybeSingle(),
      sb.from("planes").select("id,nombre,precio_mensual,moneda").eq("activo", true).order("precio_mensual"),
      sb.from("pagos_suscripcion").select("id,monto,moneda,estado,fecha").eq("taller_id", taller.id).order("fecha", { ascending: false }).limit(12),
    ]);
    setSus((s.data as Suscripcion) ?? null);
    setPlanes((p.data ?? []) as Plan[]);
    setPagos((h.data ?? []) as Pago[]);
  }, [taller.id]);

  // Al volver de Mercado Pago, confirmar el estado sin esperar al webhook.
  useEffect(() => {
    const regreso = new URLSearchParams(window.location.search).get("mp");
    (async () => {
      await cargar();
      if (!regreso || !esDueno) return;
      setVerificando(true);
      for (let i = 0; i < 6; i++) {
        try {
          const r = await api("/api/suscripcion/sincronizar", { taller_id: taller.id });
          if (r.estado === "authorized") {
            avisar("¡Suscripción activa! Gracias.");
            break;
          }
        } catch {
          break;
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
      await cargar();
      setVerificando(false);
      window.history.replaceState(null, "", "/panel/suscripcion");
    })();
  }, [cargar, esDueno, taller.id, avisar]);

  async function suscribirse() {
    if (!elegido) return;
    setError(null);
    setOcupado("checkout");
    try {
      const r = await api("/api/suscripcion/checkout", { taller_id: taller.id, plan_id: elegido.id, payer_email: correo });
      if (r.init_point) {
        window.location.href = r.init_point;
        return;
      }
      avisar("Plan actualizado");
      setElegido(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  }

  async function cancelarSuscripcion() {
    setOcupado("cancelar");
    try {
      await api("/api/suscripcion/cancelar", { taller_id: taller.id });
      avisar("Cobros cancelados. Tu servicio sigue hasta el fin del periodo pagado.");
      setCancelar(false);
      await cargar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setOcupado(null);
    }
  }

  if (!esDueno) return <Vacio titulo="Solo el dueño puede ver la suscripción" />;
  if (sus === undefined) return <Cargando />;

  const ahora = new Date();
  const vigente = !!sus && (sus.estado === "prueba" || sus.estado === "activa") && (!sus.vence_en || new Date(sus.vence_en) > ahora);
  const autorizada = sus?.mp_estado === "authorized";
  const diasRestantes = sus?.vence_en ? Math.max(0, Math.ceil((new Date(sus.vence_en).getTime() - ahora.getTime()) / 86400e3)) : null;
  const planActual = planes.find((p) => p.id === sus?.plan_id);
  const fechaVence = sus?.vence_en ? fechaLarga(diaClave(sus.vence_en, taller.zona_horaria)) : null;

  let titulo = "Sin suscripción vigente";
  let detalle = "Elige un plan para volver a recibir citas en línea.";
  if (sus?.estado === "prueba" && vigente) {
    titulo = "Periodo de prueba";
    detalle = `Termina el ${fechaVence} · quedan ${diasRestantes} días.${autorizada ? " Tu primer cobro será al terminar la prueba." : ""}`;
  } else if (autorizada && vigente) {
    titulo = `Plan ${planActual?.nombre ?? ""}`.trim();
    detalle = `Cobro automático con Mercado Pago. Próxima renovación cerca del ${fechaVence}.`;
  } else if (vigente && (sus?.mp_estado === "cancelled" || sus?.mp_estado === "paused")) {
    titulo = `Plan ${planActual?.nombre ?? ""}`.trim();
    detalle = `Cancelaste los cobros. Tu servicio sigue hasta el ${fechaVence}.`;
  } else if (vigente) {
    titulo = `Plan ${planActual?.nombre ?? "activo"}`;
    detalle = fechaVence ? `Vigente hasta el ${fechaVence}.` : "Sin fecha de vencimiento.";
  }

  return (
    <div className="max-w-4xl">
      <EncabezadoPagina titulo="Suscripción" descripcion="Pagos seguros con Mercado Pago. Cancela cuando quieras." />

      {verificando && (
        <Aviso tono="info" className="mb-4 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Confirmando tu pago con Mercado Pago…
        </Aviso>
      )}

      <Tarjeta className="mb-8 flex flex-wrap items-center gap-4 p-5">
        <div className={cx("grid size-12 place-items-center rounded-2xl", vigente ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          <Sparkles className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{titulo}</p>
            <Insignia className={vigente ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}>
              {vigente ? "Recibiendo citas" : "Citas en línea pausadas"}
            </Insignia>
          </div>
          <p className="mt-0.5 text-sm text-muted">{detalle}</p>
        </div>
        {autorizada && (
          <Boton variante="secundario" tam="sm" onClick={() => setCancelar(true)}>
            Cancelar cobros
          </Boton>
        )}
      </Tarjeta>

      <h2 className="mb-3 font-semibold">Planes</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {planes.map((p) => {
          const esActual = autorizada && sus?.plan_id === p.id;
          return (
            <Tarjeta key={p.id} className={cx("flex flex-col p-6", esActual && "ring-2 ring-brand")}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">{p.nombre}</p>
                {esActual && <Insignia className="bg-brand text-brand-ink ring-brand">Tu plan</Insignia>}
              </div>
              <p className="mt-3 text-4xl font-semibold tracking-tight">
                ${Number(p.precio_mensual).toLocaleString("es-MX")}
                <span className="text-base font-normal text-muted"> {p.moneda}/mes</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-[15px]">
                {(BENEFICIOS[p.id] ?? []).map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {b}
                  </li>
                ))}
              </ul>
              {!esActual && (
                <Boton
                  className="mt-6 w-full"
                  variante={p.id === "basico" ? "oscuro" : "primario"}
                  icono={<CreditCard className="size-4" />}
                  onClick={() => {
                    setError(null);
                    setElegido(p);
                  }}
                >
                  {autorizada ? "Cambiar a este plan" : "Suscribirme"}
                </Boton>
              )}
            </Tarjeta>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-2 text-sm text-muted">
        <ShieldCheck className="size-4 text-emerald-600" /> Tus datos de pago los maneja Mercado Pago; MYRAC nunca ve tu tarjeta.
      </p>

      {pagos.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-semibold">Historial de cobros</h2>
          <Tarjeta className="divide-y divide-line">
            {pagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
                <span>{p.fecha ? fechaLarga(diaClave(p.fecha, taller.zona_horaria)) : "—"}</span>
                <span className="tabular-nums">
                  ${Number(p.monto ?? 0).toLocaleString("es-MX")} {p.moneda}
                </span>
                <Insignia
                  className={p.estado === "approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}
                >
                  {p.estado === "approved" ? "Pagado" : "No aprobado"}
                </Insignia>
              </div>
            ))}
          </Tarjeta>
        </>
      )}

      <Modal
        abierto={!!elegido}
        onCerrar={() => setElegido(null)}
        titulo={autorizada ? `Cambiar al plan ${elegido?.nombre}` : `Suscribirme al plan ${elegido?.nombre}`}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setElegido(null)}>
              Cancelar
            </Boton>
            <Boton onClick={suscribirse} cargando={ocupado === "checkout"} icono={<CreditCard className="size-4" />}>
              {autorizada ? "Cambiar plan" : "Ir a Mercado Pago"}
            </Boton>
          </>
        }
      >
        {elegido && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between rounded-2xl bg-zinc-50 p-4">
              <span className="font-medium">{elegido.nombre}</span>
              <span className="text-xl font-semibold">
                ${Number(elegido.precio_mensual).toLocaleString("es-MX")} <span className="text-sm font-normal text-muted">{elegido.moneda}/mes</span>
              </span>
            </div>
            {autorizada ? (
              <p className="text-sm text-muted">El nuevo monto se cobrará en tu próxima renovación con la misma tarjeta.</p>
            ) : (
              <>
                <Campo etiqueta="Correo de tu cuenta de Mercado Pago" ayuda="Debe ser el mismo con el que entrarás a Mercado Pago para pagar.">
                  <Entrada type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                </Campo>
                {sus?.estado === "prueba" && vigente && (
                  <Aviso tono="exito">No se te cobra nada hoy: el primer cobro será al terminar tu prueba, el {fechaVence}.</Aviso>
                )}
                <p className="text-sm text-muted">Te llevaremos a Mercado Pago para registrar tu tarjeta. Después se cobra cada mes en automático.</p>
              </>
            )}
            {error && <Aviso tono="error">{error}</Aviso>}
          </div>
        )}
      </Modal>

      <Modal
        abierto={cancelar}
        onCerrar={() => setCancelar(false)}
        titulo="¿Cancelar los cobros automáticos?"
        pie={
          <>
            <Boton variante="secundario" onClick={() => setCancelar(false)}>
              Mantener mi plan
            </Boton>
            <Boton variante="peligro" onClick={cancelarSuscripcion} cargando={ocupado === "cancelar"}>
              Sí, cancelar
            </Boton>
          </>
        }
      >
        <p className="text-[15px] text-zinc-700">
          Ya no se te cobrará. Tu taller seguirá recibiendo citas hasta el {fechaVence ?? "fin del periodo pagado"}; después, tu página de citas se pausará hasta que vuelvas a suscribirte.
        </p>
      </Modal>
    </div>
  );
}
