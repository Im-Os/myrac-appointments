"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CircleAlert, KeyRound, MessageCircle, MoveRight, Warehouse } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { Boton, Cargando, EncabezadoPagina, Insignia, Modal, Selector, Tarjeta, cx, useAvisos } from "@/components/ui";
import { ESTADO_ESTANCIA } from "@/lib/estados";
import { diaClave, enlaceWhatsApp, fechaCorta, hoyClave, sumarDias } from "@/lib/fechas";
import { mensajeError, supabase } from "@/lib/supabase";
import type { Estancia, EstadoEstancia } from "@/lib/tipos";

const SELECT =
  "id,cita_id,bahia,ingreso,salida_estimada,salida_real,estado,notas,vehiculo:vehiculos(marca,modelo,anio,placas,cliente:clientes(nombre,telefono)),cita:citas(servicio:servicios(nombre))";

export default function Bahias() {
  const { taller } = usePanel();
  const avisar = useAvisos();
  const [lista, setLista] = useState<Estancia[] | null>(null);
  const [mover, setMover] = useState<Estancia | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase()
      .from("estancias")
      .select(SELECT)
      .eq("taller_id", taller.id)
      .is("salida_real", null)
      .order("ingreso");
    if (error) avisar(mensajeError(error), "error");
    setLista((data ?? []) as unknown as Estancia[]);
  }, [taller.id, avisar]);

  useEffect(() => {
    cargar();
    const sb = supabase();
    const canal = sb
      .channel(`bahias-${taller.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "estancias", filter: `taller_id=eq.${taller.id}` }, () => cargar())
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  }, [cargar, taller.id]);

  async function actualizar(id: string, cambios: Partial<Estancia>, mensaje?: string) {
    const { error } = await supabase().from("estancias").update(cambios).eq("id", id);
    if (error) return avisar(mensajeError(error), "error");
    if (mensaje) avisar(mensaje);
    cargar();
  }

  async function entregar(e: Estancia) {
    if (!confirm(`¿Entregar el ${e.vehiculo?.marca} ${e.vehiculo?.modelo}? La bahía quedará libre.`)) return;
    const { error } = await supabase().rpc("entregar_auto", { p_estancia_id: e.id });
    if (error) return avisar(mensajeError(error), "error");
    avisar("Auto entregado. Bahía libre.");
    cargar();
  }

  if (!lista) return <Cargando />;

  const porBahia = new Map(lista.filter((e) => e.bahia != null).map((e) => [e.bahia!, e]));
  const sinBahia = lista.filter((e) => e.bahia == null);
  const ocupadas = lista.length;
  const sinFecha = lista.filter((e) => !e.salida_estimada).length;

  return (
    <div>
      <EncabezadoPagina
        titulo="Bahías"
        descripcion="Un auto ocupa su bahía desde que entra hasta que se entrega."
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Tarjeta className="p-4">
          <p className="text-sm text-muted">Ocupadas</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {ocupadas}
            <span className="text-base font-normal text-muted">/{taller.bahias_total}</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(100, (ocupadas / taller.bahias_total) * 100)}%` }} />
          </div>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-sm text-muted">Libres</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{Math.max(0, taller.bahias_total - ocupadas)}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-sm text-muted">Sin fecha de entrega</p>
          <p className={cx("mt-1 text-2xl font-semibold tabular-nums", sinFecha > 0 && "text-amber-600")}>{sinFecha}</p>
        </Tarjeta>
      </div>

      {sinBahia.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <CircleAlert className="size-4 text-amber-600" /> Recibidos sin bahía asignada
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sinBahia.map((e) => (
              <TarjetaAuto key={e.id} e={e} onActualizar={actualizar} onEntregar={entregar} onMover={() => setMover(e)} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: taller.bahias_total }, (_, i) => i + 1).map((b) => {
          const e = porBahia.get(b);
          return e ? (
            <TarjetaAuto key={b} e={e} onActualizar={actualizar} onEntregar={entregar} onMover={() => setMover(e)} />
          ) : (
            <div key={b} className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-400">
              <Warehouse className="size-6" />
              <p className="mt-2 text-sm font-semibold">Bahía {b}</p>
              <p className="text-xs">Libre</p>
            </div>
          );
        })}
      </div>

      <ModalMover estancia={mover} ocupadas={[...porBahia.keys()]} onCerrar={() => setMover(null)} onGuardar={(b) => mover && actualizar(mover.id, { bahia: b }, b ? `Movido a la bahía ${b}` : "Bahía liberada").then(() => setMover(null))} />
    </div>
  );
}

function TarjetaAuto({
  e,
  onActualizar,
  onEntregar,
  onMover,
}: {
  e: Estancia;
  onActualizar: (id: string, c: Partial<Estancia>, m?: string) => void;
  onEntregar: (e: Estancia) => void;
  onMover: () => void;
}) {
  const { taller } = usePanel();
  const tz = taller.zona_horaria;
  const hoy = hoyClave(tz);
  const est = ESTADO_ESTANCIA[e.estado];
  const vencida = e.salida_estimada && e.salida_estimada < hoy;
  const v = e.vehiculo;
  const cliente = v?.cliente;
  const textoListo = `Hola ${cliente?.nombre?.split(" ")[0] ?? ""}, tu ${v?.marca} ${v?.modelo} ya está listo en ${taller.nombre}. ¡Te esperamos!`;

  return (
    <Tarjeta className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">{e.bahia ? `Bahía ${e.bahia}` : "Sin bahía"}</p>
          <p className="mt-1 truncate text-[17px] font-semibold">
            {v?.marca} {v?.modelo} <span className="font-normal text-muted">{v?.anio ?? ""}</span>
          </p>
          <p className="truncate text-sm text-muted">
            {v?.placas && <span className="mr-1.5 font-mono">{v.placas}</span>}
            {cliente?.nombre}
          </p>
        </div>
        <button onClick={onMover} className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100" title="Cambiar bahía" aria-label="Cambiar bahía">
          <MoveRight className="size-4" />
        </button>
      </div>

      {e.cita?.servicio?.nombre && <p className="mt-3 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-700">{e.cita.servicio.nombre}</p>}

      <div className="mt-3 grid gap-2">
        <Selector
          value={e.estado}
          onChange={(ev) => onActualizar(e.id, { estado: ev.target.value as EstadoEstancia }, "Estado actualizado")}
          className="h-10 text-sm"
        >
          {(Object.keys(ESTADO_ESTANCIA) as EstadoEstancia[])
            .filter((k) => k !== "entregado")
            .map((k) => (
              <option key={k} value={k}>
                {ESTADO_ESTANCIA[k].etiqueta}
              </option>
            ))}
        </Selector>
        <label className={cx("flex h-10 items-center gap-2 rounded-xl px-3 text-sm ring-1 ring-inset", vencida ? "bg-rose-50 ring-rose-200 text-rose-800" : !e.salida_estimada ? "bg-amber-50 ring-amber-200 text-amber-900" : "bg-white ring-line")}>
          <CalendarClock className="size-4 shrink-0 opacity-70" />
          <span className="shrink-0">Entrega:</span>
          <input
            type="date"
            min={hoy}
            max={sumarDias(hoy, 365)}
            value={e.salida_estimada ?? ""}
            onChange={(ev) => onActualizar(e.id, { salida_estimada: ev.target.value || null }, "Fecha de entrega actualizada")}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          {!e.salida_estimada && <span className="shrink-0 text-xs font-medium">Sin fecha</span>}
          {vencida && <span className="shrink-0 text-xs font-medium">Vencida</span>}
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
        <Insignia className={est.clase} punto={est.punto}>
          {est.etiqueta}
        </Insignia>
        <span className="capitalize">Entró {fechaCorta(diaClave(e.ingreso, tz))}</span>
      </div>

      <div className="mt-4 flex gap-2 border-t border-line pt-3">
        {cliente?.telefono && (
          <a
            href={enlaceWhatsApp(cliente.telefono, e.estado === "listo" ? textoListo : undefined)}
            target="_blank"
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-medium ring-1 ring-line hover:bg-zinc-50"
          >
            <MessageCircle className="size-4 text-emerald-600" /> {e.estado === "listo" ? "Avisar" : "WhatsApp"}
          </a>
        )}
        <Boton tam="sm" variante="oscuro" className="h-9 flex-1" icono={<KeyRound className="size-4" />} onClick={() => onEntregar(e)}>
          Entregar
        </Boton>
      </div>
    </Tarjeta>
  );
}

function ModalMover({
  estancia,
  ocupadas,
  onCerrar,
  onGuardar,
}: {
  estancia: Estancia | null;
  ocupadas: number[];
  onCerrar: () => void;
  onGuardar: (b: number | null) => void;
}) {
  const { taller } = usePanel();
  if (!estancia) return null;
  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Mover ${estancia.vehiculo?.marca ?? ""} ${estancia.vehiculo?.modelo ?? ""}`}>
      <p className="mb-3 text-sm text-muted">Elige la bahía libre a la que pasa el auto.</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: taller.bahias_total }, (_, i) => i + 1).map((b) => {
          const actual = estancia.bahia === b;
          const ocupada = ocupadas.includes(b) && !actual;
          return (
            <button
              key={b}
              disabled={ocupada || actual}
              onClick={() => onGuardar(b)}
              className={cx(
                "h-12 rounded-xl text-[15px] font-semibold tabular-nums ring-1",
                actual && "bg-brand text-brand-ink ring-brand",
                ocupada && "bg-zinc-100 text-zinc-300 ring-zinc-100 line-through",
                !actual && !ocupada && "bg-white ring-line hover:ring-zinc-400",
              )}
            >
              {b}
            </button>
          );
        })}
      </div>
      {estancia.bahia != null && (
        <button onClick={() => onGuardar(null)} className="mt-4 text-sm text-muted hover:text-zinc-900">
          Quitar de la bahía (sigue dentro del taller)
        </button>
      )}
    </Modal>
  );
}
