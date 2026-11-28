"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, PartyPopper, X, Clock, Warehouse, CalendarCheck2 } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { AvisoConfirmada, DetalleCita, SELECT_CITA, TarjetaCita, nombreVehiculo } from "@/components/citas";
import { avisarCliente } from "@/lib/avisos";
import { Aviso, Boton, Cargando, Tarjeta, Vacio, cx, useAvisos } from "@/components/ui";
import {
  aInstante,
  diaClave,
  fechaCorta,
  fechaLarga,
  hora,
  hoyClave,
  inicioSemana,
  mesAnio,
  nombreDia,
  numeroDia,
  mayus,
  relativoDia,
  sumarDias,
} from "@/lib/fechas";
import { mensajeError, supabase } from "@/lib/supabase";
import type { CitaAgenda } from "@/lib/tipos";

type Vista = "dia" | "semana";

export default function Agenda() {
  const { taller, esDueno } = usePanel();
  const tz = taller.zona_horaria;
  const [aviso, setAviso] = useState<{ dias: number; vigente: boolean } | null>(null);
  const avisar = useAvisos();
  const [vista, setVista] = useState<Vista>("dia");
  const [dia, setDia] = useState(() => hoyClave(tz));
  const [citas, setCitas] = useState<CitaAgenda[] | null>(null);
  const [pendientes, setPendientes] = useState<CitaAgenda[]>([]);
  const [ocupadas, setOcupadas] = useState(0);
  const [abierta, setAbierta] = useState<CitaAgenda | null>(null);
  const [bienvenida, setBienvenida] = useState(false);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [recienConfirmada, setRecienConfirmada] = useState<CitaAgenda | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("bienvenida")) setBienvenida(true);
  }, []);

  // Aviso de suscripción: prueba por terminar o citas en línea pausadas.
  useEffect(() => {
    if (!esDueno) return;
    supabase()
      .from("suscripciones")
      .select("estado,vence_en,mp_estado")
      .eq("taller_id", taller.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const restante = data.vence_en ? (new Date(data.vence_en).getTime() - Date.now()) / 86400e3 : Infinity;
        const vigente = (data.estado === "prueba" || data.estado === "activa") && restante > 0;
        const porVencer = vigente && data.mp_estado !== "authorized" && restante <= 7;
        if (!vigente || porVencer) setAviso({ dias: Math.max(0, Math.ceil(restante)), vigente });
      });
  }, [esDueno, taller.id]);

  const rango = useMemo(() => {
    const desde = vista === "dia" ? dia : inicioSemana(dia);
    const hasta = sumarDias(desde, vista === "dia" ? 1 : 7);
    return { desde, hasta };
  }, [vista, dia]);

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [r1, r2, r3] = await Promise.all([
      sb
        .from("citas")
        .select(SELECT_CITA)
        .eq("taller_id", taller.id)
        .gte("inicio", aInstante(rango.desde, "00:00", tz))
        .lt("inicio", aInstante(rango.hasta, "00:00", tz))
        .order("inicio"),
      sb
        .from("citas")
        .select(SELECT_CITA)
        .eq("taller_id", taller.id)
        .eq("estado", "pendiente")
        .gte("inicio", new Date(Date.now() - 12 * 3600e3).toISOString())
        .order("inicio")
        .limit(20),
      sb.from("estancias").select("id", { count: "exact", head: true }).eq("taller_id", taller.id).is("salida_real", null),
    ]);
    if (r1.error) avisar(mensajeError(r1.error), "error");
    setCitas((r1.data ?? []) as unknown as CitaAgenda[]);
    setPendientes((r2.data ?? []) as unknown as CitaAgenda[]);
    setOcupadas(r3.count ?? 0);
  }, [taller.id, rango, tz, avisar]);

  useEffect(() => {
    setCitas(null);
    cargar();
  }, [cargar]);

  // Tiempo real: si llega o cambia una cita, se actualiza sola.
  useEffect(() => {
    const sb = supabase();
    const canal = sb
      .channel(`agenda-${taller.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "citas", filter: `taller_id=eq.${taller.id}` }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "estancias", filter: `taller_id=eq.${taller.id}` }, () => cargar())
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  }, [taller.id, cargar]);

  async function confirmarRapido(c: CitaAgenda) {
    const { error } = await supabase().rpc("confirmar_cita", { p_cita_id: c.id });
    if (error) return avisar(mensajeError(error), "error");
    avisar("Cita confirmada");
    avisarCliente(c.token_cliente);
    setRecienConfirmada({ ...c, estado: "confirmada" });
    cargar();
  }

  const hoy = hoyClave(tz);
  const visibles = (citas ?? []).filter((c) => verCanceladas || (c.estado !== "cancelada" && c.estado !== "no_asistio"));
  const activasDia = (citas ?? []).filter((c) => c.estado !== "cancelada" && c.estado !== "no_asistio");
  const enlace = typeof window !== "undefined" ? `${window.location.origin}/${taller.slug}` : `/${taller.slug}`;

  return (
    <div>
      {bienvenida && (
        <Tarjeta className="aparecer mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 bg-zinc-950 p-5 text-white">
            <PartyPopper className="size-7 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">¡Tu taller está listo!</p>
              <p className="text-sm text-zinc-400">Comparte tu página de citas con tus clientes.</p>
            </div>
            <button onClick={() => setBienvenida(false)} className="text-zinc-400 hover:text-white" aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-4">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2 text-sm">{enlace}</code>
            <Boton
              variante="secundario"
              tam="sm"
              icono={<Copy className="size-4" />}
              onClick={() => {
                navigator.clipboard.writeText(enlace);
                avisar("Enlace copiado");
              }}
            >
              Copiar
            </Boton>
            <Link href="/panel/configuracion#pagina" className="text-sm font-medium text-zinc-700 hover:underline">
              Ver código QR
            </Link>
          </div>
        </Tarjeta>
      )}

      {aviso && (
        <Aviso tono={aviso.vigente ? "alerta" : "error"} className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span>
            {aviso.vigente
              ? `Tu periodo de prueba termina en ${aviso.dias} ${aviso.dias === 1 ? "día" : "días"}. Suscríbete para no pausar tus citas en línea.`
              : "Tu página de citas está pausada: no hay una suscripción vigente."}
          </span>
          <Link href="/panel/suscripcion" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            Ver planes
          </Link>
        </Aviso>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{mayus(mesAnio(dia))}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {vista === "dia" ? (
              <>
                {relativoDia(dia, tz) && <span className="text-brand">{relativoDia(dia, tz)} · </span>}
                <span>{relativoDia(dia, tz) ? fechaLarga(dia) : mayus(fechaLarga(dia))}</span>
              </>
            ) : (
              <span>
                Semana del {numeroDia(inicioSemana(dia))} al {fechaCorta(sumarDias(inicioSemana(dia), 6))}
              </span>
            )}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-line">
            {(["dia", "semana"] as Vista[]).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", vista === v ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900")}
              >
                {v === "dia" ? "Día" : "Semana"}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-xl bg-white ring-1 ring-line">
            <button onClick={() => setDia(sumarDias(dia, vista === "dia" ? -1 : -7))} className="grid size-10 place-items-center text-zinc-600 hover:text-zinc-900" aria-label="Anterior">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => setDia(hoy)} className="px-2 text-sm font-medium text-zinc-700 hover:text-zinc-950">
              Hoy
            </button>
            <button onClick={() => setDia(sumarDias(dia, vista === "dia" ? 1 : 7))} className="grid size-10 place-items-center text-zinc-600 hover:text-zinc-900" aria-label="Siguiente">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <Link href={`/panel/citas/nueva?dia=${dia}`} className="hidden h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink hover:brightness-110 sm:inline-flex">
            <CalendarPlus className="size-4" /> Nueva cita
          </Link>
        </div>
      </div>

      {/* Indicadores */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Indicador icono={<CalendarCheck2 className="size-4" />} titulo={vista === "dia" ? "Citas del día" : "Citas de la semana"} valor={citas ? activasDia.length : "–"} />
        <Indicador icono={<Clock className="size-4" />} titulo="Por confirmar" valor={pendientes.length} resaltar={pendientes.length > 0} />
        <Indicador
          icono={<Warehouse className="size-4" />}
          titulo="Bahías ocupadas"
          valor={`${ocupadas}/${taller.bahias_total}`}
          href="/panel/bahias"
        />
      </div>

      {pendientes.length > 0 && (
        <Tarjeta className="mb-6 overflow-hidden ring-amber-200">
          <div className="flex items-center gap-2 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <Clock className="size-4" /> {pendientes.length === 1 ? "1 cita espera" : `${pendientes.length} citas esperan`} tu confirmación
          </div>
          <ul className="divide-y divide-line">
            {pendientes.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setAbierta(c)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[15px] font-medium">
                    {nombreVehiculo(c.vehiculo)} · <span className="font-normal text-muted">{c.servicio?.nombre}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {mayus(fechaCorta(diaClave(c.inicio, tz)))}, {hora(c.inicio, tz)} · {c.cliente?.nombre}
                  </p>
                </button>
                <Boton tam="sm" variante="oscuro" icono={<Check className="size-4" />} onClick={() => confirmarRapido(c)}>
                  Confirmar
                </Boton>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {citas === null ? (
        <Cargando />
      ) : vista === "dia" ? (
        <Tarjeta className="p-2 sm:p-3">
          {visibles.length === 0 ? (
            <Vacio
              icono={<CalendarCheck2 className="size-6" />}
              titulo={dia < hoy ? "No hubo citas este día" : "Sin citas por ahora"}
              texto={dia >= hoy ? "Cuando un cliente reserve en tu página aparecerá aquí al instante." : undefined}
              accion={
                dia >= hoy && (
                  <Link href={`/panel/citas/nueva?dia=${dia}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">
                    <CalendarPlus className="size-4" /> Agendar una cita
                  </Link>
                )
              }
            />
          ) : (
            <ListaPorHora citas={visibles} tz={tz} onAbrir={setAbierta} />
          )}
        </Tarjeta>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:px-0">
          <div className="grid min-w-[840px] grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => sumarDias(inicioSemana(dia), i)).map((d) => {
              const delDia = visibles.filter((c) => diaClave(c.inicio, tz) === d);
              return (
                <div key={d} className={cx("flex min-h-64 flex-col rounded-2xl bg-white p-2 ring-1", d === hoy ? "ring-brand" : "ring-line")}>
                  <button
                    onClick={() => {
                      setDia(d);
                      setVista("dia");
                    }}
                    className="mb-2 flex items-baseline justify-between rounded-lg px-1.5 py-1 text-left hover:bg-zinc-50"
                  >
                    <span className="text-xs font-medium uppercase text-muted">{nombreDia(d)}</span>
                    <span className={cx("text-lg font-semibold tabular-nums", d === hoy && "text-brand")}>{numeroDia(d)}</span>
                  </button>
                  <div className="space-y-1.5">
                    {delDia.map((c) => (
                      <TarjetaCita key={c.id} cita={c} compacta onAbrir={() => setAbierta(c)} />
                    ))}
                    {delDia.length === 0 && <p className="px-1.5 pt-2 text-xs text-zinc-400">Sin citas</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {citas && citas.some((c) => c.estado === "cancelada" || c.estado === "no_asistio") && (
        <button onClick={() => setVerCanceladas((v) => !v)} className="mt-3 text-sm text-muted hover:text-zinc-900">
          {verCanceladas ? "Ocultar canceladas y no asistidas" : "Mostrar canceladas y no asistidas"}
        </button>
      )}

      <DetalleCita cita={abierta} onCerrar={() => setAbierta(null)} onCambio={cargar} />
      {recienConfirmada && <AvisoConfirmada abierto cita={recienConfirmada} onCerrar={() => setRecienConfirmada(null)} />}
    </div>
  );
}

function ListaPorHora({ citas, tz, onAbrir }: { citas: CitaAgenda[]; tz: string; onAbrir: (c: CitaAgenda) => void }) {
  const grupos = new Map<string, CitaAgenda[]>();
  for (const c of citas) {
    const h = hora(c.inicio, tz);
    grupos.set(h, [...(grupos.get(h) ?? []), c]);
  }
  return (
    <div className="divide-y divide-line">
      {[...grupos.entries()].map(([h, lista]) => (
        <div key={h} className="flex gap-3 px-1 py-2 sm:gap-5 sm:px-2 sm:py-3">
          <div className="hidden w-20 shrink-0 pt-3 text-right text-sm font-semibold tabular-nums text-zinc-500 sm:block">{h}</div>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((c) => (
              <TarjetaCita key={c.id} cita={c} onAbrir={() => onAbrir(c)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Indicador({ icono, titulo, valor, resaltar, href }: { icono: ReactNode; titulo: string; valor: ReactNode; resaltar?: boolean; href?: string }) {
  const cuerpo = (
    <Tarjeta className={cx("p-3.5 sm:p-4", href && "transition hover:ring-zinc-300")}>
      <div className="flex items-center gap-2 text-muted">
        <span className={cx("hidden size-7 shrink-0 place-items-center rounded-lg sm:grid", resaltar ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600")}>{icono}</span>
        <span className="text-xs font-medium leading-tight sm:text-sm">{titulo}</span>
      </div>
      <p className={cx("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:mt-2", resaltar && "text-amber-600")}>{valor}</p>
    </Tarjeta>
  );
  return href ? <Link href={href}>{cuerpo}</Link> : cuerpo;
}
