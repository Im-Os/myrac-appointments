"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, Car, CheckCircle2, Clock, MessageCircle, Wrench, XCircle } from "lucide-react";
import { MarcoPublico } from "@/components/marco-publico";
import { SelectorHorario } from "@/components/selector-horario";
import { Aviso, Boton, Cargando, Modal, Tarjeta, Vacio, cx } from "@/components/ui";
import { diaClave, enlaceWhatsApp, fechaLarga, hora } from "@/lib/fechas";
import { mensajeError, supabase } from "@/lib/supabase";
import type { EstadoCita, TallerPublico } from "@/lib/tipos";

type CitaToken = {
  cita_id: string;
  inicio: string;
  estado: EstadoCita;
  taller_nombre: string;
  taller_slug: string;
  taller_telefono: string | null;
  taller_direccion: string | null;
  zona_horaria: string;
  servicio_id: string;
  servicio_nombre: string;
  vehiculo: string;
  cliente_nombre: string;
};

const ESTADOS: Record<EstadoCita, { titulo: string; texto: string; icono: typeof CheckCircle2; clase: string }> = {
  confirmada: { titulo: "Cita confirmada", texto: "Te esperamos. Llega unos minutos antes.", icono: CheckCircle2, clase: "bg-emerald-50 text-emerald-700" },
  pendiente: {
    titulo: "Cita solicitada",
    texto: "Tu lugar está apartado. El taller confirmará tu cita en breve.",
    icono: Clock,
    clase: "bg-amber-50 text-amber-700",
  },
  recibida: { titulo: "Auto recibido", texto: "Tu auto ya está en el taller.", icono: Car, clase: "bg-sky-50 text-sky-700" },
  cancelada: { titulo: "Cita cancelada", texto: "Esta cita fue cancelada.", icono: XCircle, clase: "bg-zinc-100 text-zinc-600" },
  no_asistio: { titulo: "Cita no atendida", texto: "No se registró tu llegada a esta cita.", icono: XCircle, clase: "bg-zinc-100 text-zinc-600" },
};

function fechaIcs(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export default function MiCita({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [cita, setCita] = useState<CitaToken | null | undefined>(undefined);
  const [taller, setTaller] = useState<TallerPublico | null>(null);
  const [nueva, setNueva] = useState(false);
  const [reprogramar, setReprogramar] = useState(false);
  const [nuevoInicio, setNuevoInicio] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.rpc("cita_por_token", { p_token: token });
    const c = (data as CitaToken[] | null)?.[0] ?? null;
    setCita(c);
    if (c) {
      const { data: t } = await sb.rpc("taller_publico", { p_slug: c.taller_slug });
      setTaller((t as TallerPublico[] | null)?.[0] ?? null);
    }
  }, [token]);

  useEffect(() => {
    if (/^[0-9a-f-]{36}$/i.test(token)) cargar();
    else setCita(null);
    setNueva(new URLSearchParams(window.location.search).get("nueva") === "1");
  }, [cargar, token]);

  if (cita === undefined || (cita && !taller)) return <Cargando className="min-h-dvh" />;
  if (!cita || !taller)
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <Vacio titulo="No encontramos esta cita" texto="Revisa que el enlace esté completo." />
      </div>
    );

  const tz = cita.zona_horaria;
  const e = ESTADOS[cita.estado];
  const Icono = e.icono;
  const activa = (cita.estado === "pendiente" || cita.estado === "confirmada") && new Date(cita.inicio) > new Date();
  const fin = new Date(new Date(cita.inicio).getTime() + taller.intervalo_min * 60e3).toISOString();
  const titulo = `Cita en ${cita.taller_nombre}: ${cita.servicio_nombre}`;
  const detalles = `${cita.vehiculo}. Para cancelar o cambiar: ${typeof window !== "undefined" ? window.location.href.split("?")[0] : ""}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${fechaIcs(cita.inicio)}/${fechaIcs(fin)}&details=${encodeURIComponent(detalles)}&location=${encodeURIComponent(cita.taller_direccion ?? cita.taller_nombre)}`;

  function descargarIcs() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MYRAC Appointments//ES",
      "BEGIN:VEVENT",
      `UID:${cita!.cita_id}@myrac`,
      `DTSTAMP:${fechaIcs(new Date().toISOString())}`,
      `DTSTART:${fechaIcs(cita!.inicio)}`,
      `DTEND:${fechaIcs(fin)}`,
      `SUMMARY:${titulo}`,
      `DESCRIPTION:${detalles}`,
      `LOCATION:${cita!.taller_direccion ?? cita!.taller_nombre}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT2H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Recordatorio de cita",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cita.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function cancelar() {
    if (!confirm("¿Seguro que quieres cancelar tu cita?")) return;
    setOcupado(true);
    setError(null);
    const { error } = await supabase().rpc("cancelar_cita_publica", { p_token: token });
    setOcupado(false);
    if (error) return setError(mensajeError(error));
    setNueva(false);
    cargar();
  }

  async function guardarReprogramacion() {
    if (!nuevoInicio) return;
    setOcupado(true);
    setError(null);
    const { error } = await supabase().rpc("reprogramar_cita_publica", { p_token: token, p_nuevo_inicio: nuevoInicio });
    setOcupado(false);
    if (error) return setError(mensajeError(error));
    setReprogramar(false);
    setNuevoInicio(null);
    setNueva(false);
    cargar();
  }

  const mensajeTaller = `Hola, tengo una cita el ${fechaLarga(diaClave(cita.inicio, tz))} a las ${hora(cita.inicio, tz)} (${cita.vehiculo}).`;

  return (
    <MarcoPublico taller={taller}>
      <div className="aparecer">
        <Tarjeta className="overflow-hidden">
          <div className={cx("flex items-center gap-3 px-5 py-4", e.clase)}>
            <Icono className="size-6" />
            <div>
              <p className="font-semibold">{nueva && cita.estado !== "cancelada" ? (cita.estado === "confirmada" ? "¡Listo! Tu cita está confirmada" : "¡Listo! Recibimos tu solicitud") : e.titulo}</p>
              <p className="text-sm opacity-90">{e.texto}</p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-5 text-brand" />
              <div>
                <p className="text-lg font-semibold capitalize">{fechaLarga(diaClave(cita.inicio, tz))}</p>
                <p className="text-[15px] text-muted">Llegada a las {hora(cita.inicio, tz)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 size-5 text-brand" />
              <p className="text-[15px]">{cita.servicio_nombre}</p>
            </div>
            <div className="flex items-start gap-3">
              <Car className="mt-0.5 size-5 text-brand" />
              <p className="text-[15px]">
                {cita.vehiculo} <span className="text-muted">· {cita.cliente_nombre}</span>
              </p>
            </div>
          </div>
          {activa && (
            <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
              <a href={google} target="_blank" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium ring-1 ring-line hover:bg-zinc-50">
                <CalendarPlus className="size-4" /> Google Calendar
              </a>
              <button onClick={descargarIcs} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium ring-1 ring-line hover:bg-zinc-50">
                <CalendarPlus className="size-4" /> Apple / Outlook
              </button>
            </div>
          )}
        </Tarjeta>

        {nueva && activa && (
          <Aviso tono="info" className="mt-4">
            Guarda este enlace: desde aquí puedes cambiar o cancelar tu cita.
          </Aviso>
        )}
        {error && (
          <Aviso tono="error" className="mt-4">
            {error}
          </Aviso>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {cita.taller_telefono && (
            <a
              href={enlaceWhatsApp(cita.taller_telefono, mensajeTaller)}
              target="_blank"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="size-5" /> Escribir al taller
            </a>
          )}
          {activa && (
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" tam="lg" onClick={() => setReprogramar(true)}>
                Cambiar horario
              </Boton>
              <Boton variante="peligro" tam="lg" onClick={cancelar} cargando={ocupado && !reprogramar}>
                Cancelar cita
              </Boton>
            </div>
          )}
          {!activa && (
            <Link href={`/${cita.taller_slug}`} className="inline-flex h-12 items-center justify-center rounded-xl bg-brand text-[15px] font-semibold text-brand-ink">
              Agendar otra cita
            </Link>
          )}
        </div>
      </div>

      <Modal
        abierto={reprogramar}
        onCerrar={() => setReprogramar(false)}
        titulo="Elige el nuevo horario"
        pie={
          <>
            <Boton variante="secundario" onClick={() => setReprogramar(false)}>
              Cerrar
            </Boton>
            <Boton onClick={guardarReprogramacion} disabled={!nuevoInicio} cargando={ocupado}>
              Cambiar mi cita
            </Boton>
          </>
        }
      >
        <div style={{ ["--brand" as string]: taller.color_marca }}>
          <SelectorHorario
            slug={cita.taller_slug}
            servicioId={cita.servicio_id}
            tz={tz}
            diasMax={taller.dias_anticipacion_max}
            valor={nuevoInicio}
            onElegir={setNuevoInicio}
            excluir={cita.inicio}
          />
          {!taller.confirmacion_automatica && <p className="mt-2 text-xs text-muted">El taller confirmará tu nuevo horario.</p>}
        </div>
      </Modal>
    </MarcoPublico>
  );
}
