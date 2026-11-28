"use client";

import { useEffect, useState } from "react";
import { Ban, Car, Check, MessageCircle, Phone, UserX, Warehouse, Globe, Store } from "lucide-react";
import { Aviso, Boton, Campo, Entrada, Insignia, Modal, cx, useAvisos } from "@/components/ui";
import { usePanel } from "@/components/panel-contexto";
import { ESTADO_CITA } from "@/lib/estados";
import { diaClave, enlaceWhatsApp, fechaLarga, hora, hoyClave, sumarDias, telefonoBonito } from "@/lib/fechas";
import { mensajeError, supabase } from "@/lib/supabase";
import type { CitaAgenda } from "@/lib/tipos";

export const SELECT_CITA =
  "id,inicio,estado,origen,notas,creado_en,cliente:clientes(id,nombre,telefono,email),vehiculo:vehiculos(id,marca,modelo,anio,placas),servicio:servicios(id,nombre,tipo)";

export function nombreVehiculo(v: CitaAgenda["vehiculo"]) {
  if (!v) return "Vehículo";
  return [v.marca, v.modelo, v.anio].filter(Boolean).join(" ");
}

export function TarjetaCita({ cita, onAbrir, compacta }: { cita: CitaAgenda; onAbrir: () => void; compacta?: boolean }) {
  const { taller } = usePanel();
  const e = ESTADO_CITA[cita.estado];
  const apagada = cita.estado === "cancelada" || cita.estado === "no_asistio";
  return (
    <button
      onClick={onAbrir}
      className={cx(
        "group flex w-full items-stretch gap-3 rounded-2xl bg-white text-left ring-1 ring-line transition hover:ring-zinc-300 hover:shadow-sm",
        compacta ? "p-2.5" : "p-3.5",
        apagada && "opacity-60",
      )}
    >
      <span className={cx("w-1 shrink-0 rounded-full", e.punto)} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={cx("font-semibold tabular-nums text-zinc-900", compacta ? "text-[13px]" : "text-[15px]")}>{hora(cita.inicio, taller.zona_horaria)}</span>
          {!compacta && (
            <Insignia className={e.clase} punto={e.punto}>
              {e.etiqueta}
            </Insignia>
          )}
        </span>
        <span className={cx("mt-0.5 block truncate font-medium text-zinc-900", compacta ? "text-[13px]" : "text-[15px]", apagada && "line-through")}>
          {nombreVehiculo(cita.vehiculo)}
          {cita.vehiculo?.placas && !compacta && <span className="ml-2 font-mono text-xs font-normal text-muted">{cita.vehiculo.placas}</span>}
        </span>
        <span className={cx("block truncate text-muted", compacta ? "text-xs" : "text-sm")}>
          {cita.servicio?.nombre}
          {!compacta && cita.cliente && ` · ${cita.cliente.nombre}`}
        </span>
      </span>
    </button>
  );
}

export function DetalleCita({ cita, onCerrar, onCambio }: { cita: CitaAgenda | null; onCerrar: () => void; onCambio: () => void }) {
  const { taller } = usePanel();
  const avisar = useAvisos();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recibir, setRecibir] = useState(false);
  if (!cita) return null;

  const e = ESTADO_CITA[cita.estado];
  const activa = cita.estado === "pendiente" || cita.estado === "confirmada";
  const tz = taller.zona_horaria;

  async function accion(nombre: string, fn: () => PromiseLike<{ error: unknown }>, exito: string) {
    setOcupado(nombre);
    const { error } = await fn();
    setOcupado(null);
    if (error) return avisar(mensajeError(error), "error");
    avisar(exito);
    onCambio();
    onCerrar();
  }

  const sb = supabase();
  const tel = cita.cliente?.telefono ?? "";
  const textoWa = `Hola ${cita.cliente?.nombre?.split(" ")[0] ?? ""}, te escribimos de ${taller.nombre} sobre tu cita del ${fechaLarga(
    diaClave(cita.inicio, tz),
  )} a las ${hora(cita.inicio, tz)}.`;

  return (
    <>
      <Modal
        abierto={!recibir}
        onCerrar={onCerrar}
        titulo={
          <span className="flex items-center gap-2">
            {hora(cita.inicio, tz)} · <span className="font-normal text-muted">{fechaLarga(diaClave(cita.inicio, tz))}</span>
          </span>
        }
        pie={
          activa ? (
            <>
              <Boton
                variante="peligro"
                tam="sm"
                icono={<Ban className="size-4" />}
                cargando={ocupado === "cancelar"}
                onClick={() => {
                  if (confirm("¿Cancelar esta cita? Se libera el lugar."))
                    accion("cancelar", () => sb.from("citas").update({ estado: "cancelada" }).eq("id", cita.id), "Cita cancelada");
                }}
              >
                Cancelar
              </Boton>
              <Boton
                variante="secundario"
                tam="sm"
                icono={<UserX className="size-4" />}
                cargando={ocupado === "no"}
                onClick={() => accion("no", () => sb.from("citas").update({ estado: "no_asistio" }).eq("id", cita.id), "Marcada como no asistió")}
              >
                No asistió
              </Boton>
              {cita.estado === "pendiente" && (
                <Boton
                  variante="oscuro"
                  tam="sm"
                  icono={<Check className="size-4" />}
                  cargando={ocupado === "confirmar"}
                  onClick={() => accion("confirmar", () => sb.rpc("confirmar_cita", { p_cita_id: cita.id }), "Cita confirmada")}
                >
                  Confirmar
                </Boton>
              )}
              <Boton tam="sm" icono={<Warehouse className="size-4" />} onClick={() => setRecibir(true)}>
                Recibir auto
              </Boton>
            </>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia className={e.clase} punto={e.punto}>
              {e.etiqueta}
            </Insignia>
            <Insignia className="bg-zinc-50 text-zinc-600 ring-zinc-200">
              {cita.origen === "web" ? <Globe className="size-3" /> : <Store className="size-3" />}
              {cita.origen === "web" ? "Reservó en línea" : "Agendada por el taller"}
            </Insignia>
          </div>

          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <Car className="size-5" />
            </div>
            <div>
              <p className="text-[17px] font-semibold">{nombreVehiculo(cita.vehiculo)}</p>
              <p className="text-sm text-muted">
                {cita.vehiculo?.placas ? <span className="font-mono">{cita.vehiculo.placas}</span> : "Sin placas registradas"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Servicio</p>
            <p className="mt-0.5 font-medium">{cita.servicio?.nombre}</p>
            {cita.notas && (
              <>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Notas del cliente</p>
                <p className="mt-0.5 whitespace-pre-line text-[15px]">{cita.notas}</p>
              </>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Cliente</p>
            <p className="mt-0.5 font-medium">{cita.cliente?.nombre}</p>
            <p className="text-sm text-muted">
              {telefonoBonito(tel)}
              {cita.cliente?.email && ` · ${cita.cliente.email}`}
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href={enlaceWhatsApp(tel, textoWa)}
                target="_blank"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
              <a href={`tel:${tel}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium ring-1 ring-line hover:bg-zinc-50">
                <Phone className="size-4" /> Llamar
              </a>
            </div>
          </div>
        </div>
      </Modal>
      <ModalRecibir
        abierto={recibir}
        citaId={cita.id}
        onCerrar={() => setRecibir(false)}
        onListo={() => {
          setRecibir(false);
          onCambio();
          onCerrar();
        }}
      />
    </>
  );
}

export function ModalRecibir({ abierto, citaId, onCerrar, onListo }: { abierto: boolean; citaId: string; onCerrar: () => void; onListo: () => void }) {
  const { taller } = usePanel();
  const avisar = useAvisos();
  const [ocupadas, setOcupadas] = useState<number[]>([]);
  const [bahia, setBahia] = useState<number | null>(null);
  const [salida, setSalida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setError(null);
    supabase()
      .from("estancias")
      .select("bahia")
      .eq("taller_id", taller.id)
      .is("salida_real", null)
      .then(({ data }) => {
        const o = (data ?? []).map((d) => d.bahia).filter((b): b is number => b != null);
        setOcupadas(o);
        const libre = Array.from({ length: taller.bahias_total }, (_, i) => i + 1).find((b) => !o.includes(b));
        setBahia(libre ?? null);
      });
  }, [abierto, taller.id, taller.bahias_total]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const { error } = await supabase().rpc("recibir_cita", { p_cita_id: citaId, p_bahia: bahia, p_salida_estimada: salida || null });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    avisar(bahia ? `Auto recibido en la bahía ${bahia}` : "Auto recibido");
    onListo();
  }

  const hoy = hoyClave(taller.zona_horaria);
  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Recibir auto"
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Atrás
          </Boton>
          <Boton onClick={guardar} cargando={guardando} icono={<Check className="size-4" />}>
            Recibir
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-700">Bahía</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: taller.bahias_total }, (_, i) => i + 1).map((b) => {
              const ocupada = ocupadas.includes(b);
              return (
                <button
                  key={b}
                  disabled={ocupada}
                  onClick={() => setBahia(b)}
                  className={cx(
                    "h-12 rounded-xl text-[15px] font-semibold tabular-nums ring-1 transition",
                    ocupada && "cursor-not-allowed bg-zinc-100 text-zinc-300 ring-zinc-100 line-through",
                    !ocupada && bahia === b && "bg-brand text-brand-ink ring-brand",
                    !ocupada && bahia !== b && "bg-white ring-line hover:ring-zinc-400",
                  )}
                >
                  {b}
                </button>
              );
            })}
          </div>
          <button onClick={() => setBahia(null)} className={cx("mt-2 text-sm", bahia === null ? "font-medium text-zinc-900" : "text-muted hover:text-zinc-900")}>
            {bahia === null ? "✓ " : ""}Sin bahía asignada por ahora
          </button>
          {ocupadas.length >= taller.bahias_total && (
            <Aviso tono="alerta" className="mt-3">
              Todas las bahías están ocupadas. Puedes recibirlo sin bahía y asignarla después.
            </Aviso>
          )}
        </div>
        <Campo etiqueta="Fecha estimada de entrega" ayuda="Si no la sabes aún, déjala vacía: la bahía se considera ocupada hasta que la definas.">
          <Entrada type="date" min={hoy} max={sumarDias(hoy, 365)} value={salida} onChange={(e) => setSalida(e.target.value)} />
        </Campo>
        {error && <Aviso tono="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}
