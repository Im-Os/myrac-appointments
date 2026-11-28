"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Car, Check, Zap } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { ModalRecibir } from "@/components/citas";
import { Area, Aviso, Boton, Campo, Entrada, Interruptor, Selector, Tarjeta, cx, useAvisos } from "@/components/ui";
import { aInstante, fechaLarga, hora, hora24, hoyClave, relativoDia, sumarDias } from "@/lib/fechas";
import { mensajeError, supabase } from "@/lib/supabase";
import { avisarCliente } from "@/lib/avisos";
import type { Categoria, Servicio, Slot } from "@/lib/tipos";

type ClienteHallado = {
  id: string;
  nombre: string;
  email: string | null;
  vehiculos: { id: string; marca: string; modelo: string; anio: number | null; placas: string | null }[];
};

export default function NuevaCita() {
  const { taller } = usePanel();
  const tz = taller.zona_horaria;
  const router = useRouter();
  const avisar = useAvisos();
  const hoy = hoyClave(tz);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [servicioId, setServicioId] = useState("");
  const [ahora, setAhora] = useState(false);
  const [dia, setDia] = useState(hoy);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [horaSel, setHoraSel] = useState<string>("");
  const [otraHora, setOtraHora] = useState(false);

  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [hallado, setHallado] = useState<ClienteHallado | null>(null);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [placas, setPlacas] = useState("");
  const [notas, setNotas] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recibirId, setRecibirId] = useState<string | null>(null);

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("dia");
    if (d && d >= hoy) setDia(d);
  }, [hoy]);

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from("categorias_servicio").select("id,nombre,orden").eq("taller_id", taller.id).order("orden"),
      sb.from("servicios").select("id,categoria_id,nombre,tipo,activo,orden").eq("taller_id", taller.id).eq("activo", true).order("orden"),
    ]).then(([c, s]) => {
      setCategorias((c.data ?? []) as Categoria[]);
      setServicios((s.data ?? []) as Servicio[]);
    });
  }, [taller.id]);

  useEffect(() => {
    if (!servicioId || ahora) return setSlots(null);
    setSlots(null);
    supabase()
      .rpc("horarios_disponibles", { p_slug: taller.slug, p_servicio_id: servicioId, p_desde: dia, p_hasta: dia })
      .then(({ data }) => setSlots((data ?? []) as Slot[]));
  }, [servicioId, dia, ahora, taller.slug]);

  // Busca al cliente por teléfono para no capturar dos veces.
  useEffect(() => {
    const tel = telefono.replace(/\D/g, "");
    if (tel.length !== 10) return setHallado(null);
    supabase()
      .from("clientes")
      .select("id,nombre,email,vehiculos(id,marca,modelo,anio,placas)")
      .eq("taller_id", taller.id)
      .eq("telefono", tel)
      .maybeSingle()
      .then(({ data }) => {
        const c = data as ClienteHallado | null;
        setHallado(c);
        if (c) {
          setNombre((n) => n || c.nombre);
          setEmail((e) => e || c.email || "");
        }
      });
  }, [telefono, taller.id]);

  const porCategoria = useMemo(
    () =>
      [...categorias, { id: "", nombre: "Otros", orden: 999 }]
        .map((c) => ({ ...c, servicios: servicios.filter((s) => (s.categoria_id ?? "") === c.id) }))
        .filter((c) => c.servicios.length),
    [categorias, servicios],
  );

  const enDisponibilidad = slots?.some((s) => hora24(s.inicio, tz) === horaSel);

  async function guardar() {
    setError(null);
    if (!servicioId) return setError("Elige el servicio.");
    if (!ahora && !horaSel) return setError("Elige la hora de llegada.");
    if (telefono.replace(/\D/g, "").length !== 10) return setError("El teléfono debe tener 10 dígitos.");
    if (!nombre.trim() || !marca.trim() || !modelo.trim()) return setError("Completa nombre del cliente, marca y modelo.");
    const inicio = ahora ? new Date().toISOString() : aInstante(dia, horaSel, tz);
    setGuardando(true);
    const { data, error } = await supabase().rpc("crear_cita_taller", {
      p_taller_id: taller.id,
      p_servicio_id: servicioId,
      p_inicio: inicio,
      p_nombre: nombre,
      p_telefono: telefono,
      p_email: email || null,
      p_marca: marca,
      p_modelo: modelo,
      p_anio: anio ? Number(anio) : null,
      p_placas: placas || null,
      p_notas: notas || null,
    });
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    if (!ahora) supabase()
      .from("citas")
      .select("token_cliente")
      .eq("id", data as string)
      .maybeSingle()
      .then(({ data: t }) => avisarCliente(t?.token_cliente));
    if (ahora) {
      setRecibirId(data as string);
      return;
    }
    avisar("Cita agendada");
    router.push("/panel");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-zinc-900">
        <ArrowLeft className="size-4" /> Agenda
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-[28px]">Nueva cita</h1>

      <div className="space-y-5">
        <Tarjeta className="flex items-center gap-4 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <Zap className="size-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">El auto ya está en el taller</p>
            <p className="text-sm text-muted">Llegó sin cita: se registra ahora y lo asignas a una bahía.</p>
          </div>
          <Interruptor activo={ahora} onCambio={setAhora} etiqueta="Llegó sin cita" />
        </Tarjeta>

        <Tarjeta className="space-y-5 p-5">
          <h2 className="font-semibold">Servicio{!ahora && " y horario"}</h2>
          <Campo etiqueta="Servicio">
            <Selector value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
              <option value="">Elige un servicio…</option>
              {porCategoria.map((c) => (
                <optgroup key={c.id || "otros"} label={c.nombre}>
                  {c.servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Selector>
          </Campo>

          {!ahora && (
            <>
              <Campo etiqueta="Día">
                <Entrada type="date" min={hoy} max={sumarDias(hoy, 365)} value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
              </Campo>
              <div>
                <p className="mb-2 text-[13px] font-medium text-zinc-700">
                  Hora de llegada <span className="font-normal text-muted">· {relativoDia(dia, tz) ?? fechaLarga(dia)}</span>
                </p>
                {!servicioId ? (
                  <p className="text-sm text-muted">Elige primero el servicio para ver los horarios con espacio.</p>
                ) : slots === null ? (
                  <p className="text-sm text-muted">Buscando horarios…</p>
                ) : (
                  <>
                    {slots.length === 0 && <Aviso tono="alerta">No hay horarios con espacio este día. Puedes agendar en otra hora bajo tu criterio.</Aviso>}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {slots.map((s) => {
                        const h = hora24(s.inicio, tz);
                        return (
                          <button
                            key={s.inicio}
                            onClick={() => {
                              setHoraSel(h);
                              setOtraHora(false);
                            }}
                            className={cx(
                              "h-11 rounded-xl text-sm font-medium tabular-nums ring-1 transition",
                              horaSel === h && !otraHora ? "bg-brand text-brand-ink ring-brand" : "bg-white ring-line hover:ring-zinc-400",
                            )}
                          >
                            {hora(s.inicio, tz)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button onClick={() => setOtraHora(true)} className={cx("text-sm", otraHora ? "font-medium text-zinc-900" : "text-muted hover:text-zinc-900")}>
                        Otra hora…
                      </button>
                      {otraHora && (
                        <input
                          type="time"
                          step={300}
                          value={horaSel}
                          onChange={(e) => setHoraSel(e.target.value)}
                          className="h-10 rounded-lg bg-white px-2 tabular-nums ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
                        />
                      )}
                    </div>
                    {otraHora && horaSel && !enDisponibilidad && (
                      <Aviso tono="alerta" className="mt-3">
                        Esta hora está fuera de la disponibilidad calculada (cupo o bahías). Se agendará de todos modos.
                      </Aviso>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </Tarjeta>

        <Tarjeta className="space-y-4 p-5">
          <h2 className="font-semibold">Cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Teléfono (WhatsApp)" ayuda={hallado ? "Cliente registrado ✓" : "10 dígitos"}>
              <Entrada inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="443 123 4567" />
            </Campo>
            <Campo etiqueta="Nombre">
              <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
            </Campo>
            <Campo etiqueta="Correo (opcional)" className="sm:col-span-2">
              <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Campo>
          </div>
        </Tarjeta>

        <Tarjeta className="space-y-4 p-5">
          <h2 className="font-semibold">Vehículo</h2>
          {hallado && hallado.vehiculos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hallado.vehiculos.map((v) => {
                const sel = v.marca === marca && v.modelo === modelo && (v.placas ?? "") === placas;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setMarca(v.marca);
                      setModelo(v.modelo);
                      setAnio(v.anio ? String(v.anio) : "");
                      setPlacas(v.placas ?? "");
                    }}
                    className={cx("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1", sel ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white ring-line hover:ring-zinc-400")}
                  >
                    {sel ? <Check className="size-4" /> : <Car className="size-4" />}
                    {v.marca} {v.modelo} {v.anio ?? ""} {v.placas && <span className="font-mono text-xs opacity-70">{v.placas}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-4">
            <Campo etiqueta="Marca">
              <Entrada value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Volkswagen" />
            </Campo>
            <Campo etiqueta="Modelo">
              <Entrada value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Jetta" />
            </Campo>
            <Campo etiqueta="Año">
              <Entrada inputMode="numeric" maxLength={4} value={anio} onChange={(e) => setAnio(e.target.value.replace(/\D/g, ""))} placeholder="2019" />
            </Campo>
            <Campo etiqueta="Placas">
              <Entrada value={placas} onChange={(e) => setPlacas(e.target.value.toUpperCase())} className="font-mono" />
            </Campo>
          </div>
          <Campo etiqueta="Notas">
            <Area value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Síntomas, ruido, testigo encendido…" />
          </Campo>
        </Tarjeta>

        {error && <Aviso tono="error">{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Link href="/panel" className="inline-flex h-12 items-center rounded-xl px-5 text-[15px] font-medium text-zinc-700 hover:bg-zinc-100">
            Cancelar
          </Link>
          <Boton tam="lg" onClick={guardar} cargando={guardando} icono={<Check className="size-4" />}>
            {ahora ? "Registrar y recibir" : "Agendar cita"}
          </Boton>
        </div>
      </div>

      {recibirId && (
        <ModalRecibir
          abierto
          citaId={recibirId}
          onCerrar={() => router.push("/panel")}
          onListo={() => router.push("/panel/bahias")}
        />
      )}
    </div>
  );
}
