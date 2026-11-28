"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import QRCode from "qrcode";
import { CalendarOff, Copy, Download, ExternalLink, Hand, Plus, Trash2, Zap } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { EditorHorario, editorAHorario, horarioAEditor, horarioValido } from "@/components/editor-horario";
import type { DiaHorario } from "@/components/editor-horario";
import { Area, Aviso, Boton, Campo, Cargando, EncabezadoPagina, Entrada, Interruptor, Numero, Selector, Tarjeta, Vacio, cx, useAvisos } from "@/components/ui";
import { COLORES_MARCA, tintaSobre } from "@/lib/estados";
import { aInstante, diaClave, fechaCorta, hora, hora24, hoyClave, mayus, sumarDias } from "@/lib/fechas";
import { mensajeError, supabase } from "@/lib/supabase";
import type { Bloqueo, Horario } from "@/lib/tipos";

const SECCIONES = [
  { id: "pagina", etiqueta: "Página de citas" },
  { id: "negocio", etiqueta: "Negocio" },
  { id: "capacidad", etiqueta: "Capacidad y reservas" },
  { id: "horario", etiqueta: "Horario" },
  { id: "bloqueos", etiqueta: "Días bloqueados" },
];

export default function Configuracion() {
  const { esDueno } = usePanel();
  if (!esDueno) return <Vacio titulo="Solo el dueño puede cambiar la configuración" />;
  return (
    <div>
      <EncabezadoPagina titulo="Configuración" descripcion="Ajusta tu taller. Los cambios se reflejan al instante en tu página de citas." />
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        {SECCIONES.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-line hover:ring-zinc-400">
            {s.etiqueta}
          </a>
        ))}
      </nav>
      <div className="space-y-8">
        <PaginaCitas />
        <Negocio />
        <Capacidad />
        <SeccionHorario />
        <Bloqueos />
      </div>
    </div>
  );
}

function Seccion({ id, titulo, descripcion, children }: { id: string; titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 grid gap-4 lg:grid-cols-[260px_1fr] lg:gap-8">
      <div>
        <h2 className="font-semibold">{titulo}</h2>
        {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

/* Página pública + QR ---------------------------------------------------------- */
function PaginaCitas() {
  const { taller } = usePanel();
  const avisar = useAvisos();
  const [qr, setQr] = useState<string>("");
  const enlace = `${window.location.origin}/${taller.slug}`;

  useEffect(() => {
    QRCode.toDataURL(enlace, { width: 720, margin: 2, color: { dark: "#18181b", light: "#ffffff" } }).then(setQr);
  }, [enlace]);

  return (
    <Seccion id="pagina" titulo="Tu página de citas" descripcion="Compártela en WhatsApp, Google Maps, Facebook o imprime el QR para el mostrador.">
      <Tarjeta className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {qr ? <img src={qr} alt="Código QR de la página de citas" className="size-36 shrink-0 rounded-xl ring-1 ring-line" /> : <div className="size-36 rounded-xl bg-zinc-100" />}
        <div className="min-w-0 flex-1 space-y-3">
          <code className="block truncate rounded-lg bg-zinc-100 px-3 py-2 text-sm">{enlace}</code>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              tam="sm"
              icono={<Copy className="size-4" />}
              onClick={() => {
                navigator.clipboard.writeText(enlace);
                avisar("Enlace copiado");
              }}
            >
              Copiar enlace
            </Boton>
            <a href={qr} download={`qr-${taller.slug}.png`} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-medium ring-1 ring-inset ring-line hover:bg-zinc-50">
              <Download className="size-4" /> Descargar QR
            </a>
            <a href={`/${taller.slug}`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-medium ring-1 ring-inset ring-line hover:bg-zinc-50">
              <ExternalLink className="size-4" /> Abrir
            </a>
          </div>
        </div>
      </Tarjeta>
    </Seccion>
  );
}

/* Datos del negocio ---------------------------------------------------------------- */
function Negocio() {
  const { taller, recargarTaller } = usePanel();
  const avisar = useAvisos();
  const [f, setF] = useState({
    nombre: taller.nombre,
    telefono: taller.telefono ?? "",
    direccion: taller.direccion ?? "",
    descripcion: taller.descripcion ?? "",
    color_marca: taller.color_marca,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    const tel = f.telefono.replace(/\D/g, "");
    if (tel && tel.length !== 10) return setError("El teléfono debe tener 10 dígitos.");
    if (f.nombre.trim().length < 2) return setError("Escribe el nombre del taller.");
    setGuardando(true);
    const { error } = await supabase()
      .from("talleres")
      .update({
        nombre: f.nombre.trim(),
        telefono: tel || null,
        direccion: f.direccion.trim() || null,
        descripcion: f.descripcion.trim() || null,
        color_marca: f.color_marca.toUpperCase(),
      })
      .eq("id", taller.id);
    setGuardando(false);
    if (error) return setError(mensajeError(error));
    await recargarTaller();
    avisar("Datos guardados");
  }

  return (
    <Seccion id="negocio" titulo="Datos del negocio" descripcion="Lo que ven tus clientes en tu página.">
      <Tarjeta className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre del taller">
            <Entrada value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Teléfono / WhatsApp">
            <Entrada inputMode="tel" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} placeholder="443 123 4567" />
          </Campo>
        </div>
        <Campo etiqueta="Dirección">
          <Entrada value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} placeholder="Calle, número, colonia, ciudad" />
        </Campo>
        <Campo etiqueta="Descripción breve" ayuda="Una o dos líneas: especialidad, marcas que atiendes, garantía…">
          <Area value={f.descripcion} maxLength={240} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </Campo>
        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-700">Color de tu marca</p>
          <div className="flex flex-wrap items-center gap-2">
            {COLORES_MARCA.map((c) => (
              <button
                key={c.valor}
                title={c.nombre}
                onClick={() => setF({ ...f, color_marca: c.valor })}
                className={cx("size-9 rounded-full ring-offset-2 transition", f.color_marca.toUpperCase() === c.valor ? "ring-2 ring-zinc-900" : "hover:scale-110")}
                style={{ background: c.valor }}
              />
            ))}
            <label className="relative flex h-9 items-center gap-2 rounded-full bg-white pl-1 pr-3 text-sm ring-1 ring-line">
              <input type="color" value={f.color_marca} onChange={(e) => setF({ ...f, color_marca: e.target.value })} className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              Otro
            </label>
          </div>
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-zinc-50 p-3">
            <span className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: f.color_marca, color: tintaSobre(f.color_marca) }}>
              Reservar cita
            </span>
            <span className="text-xs text-muted">Vista previa del botón</span>
          </div>
        </div>
        {error && <Aviso tono="error">{error}</Aviso>}
        <div className="flex justify-end">
          <Boton onClick={guardar} cargando={guardando} variante="oscuro">
            Guardar
          </Boton>
        </div>
      </Tarjeta>
    </Seccion>
  );
}

/* Capacidad y reservas ------------------------------------------------------------- */
function Capacidad() {
  const { taller, recargarTaller } = usePanel();
  const avisar = useAvisos();
  const [f, setF] = useState({
    bahias_total: taller.bahias_total,
    cupo_por_bloque: taller.cupo_por_bloque,
    intervalo_min: taller.intervalo_min,
    dias_anticipacion_max: taller.dias_anticipacion_max,
  });
  const [auto, setAuto] = useState(taller.confirmacion_automatica);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase().from("talleres").update(f).eq("id", taller.id);
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    await recargarTaller();
    avisar("Capacidad guardada");
  }

  async function cambiarAuto(v: boolean) {
    setAuto(v);
    const { error } = await supabase().from("talleres").update({ confirmacion_automatica: v }).eq("id", taller.id);
    if (error) {
      setAuto(!v);
      return avisar(mensajeError(error), "error");
    }
    await recargarTaller();
    avisar(v ? "Confirmación automática activada" : "Ahora confirmas cada cita a mano");
  }

  const fila = "flex flex-wrap items-center justify-between gap-3 p-5";
  return (
    <Seccion id="capacidad" titulo="Capacidad y reservas" descripcion="Determina qué horarios se ofrecen en tu página.">
      <div className="space-y-4">
        <Tarjeta className={cx("flex items-start gap-4 p-5", auto && "ring-brand/40")}>
          <div className={cx("grid size-10 shrink-0 place-items-center rounded-xl", auto ? "bg-brand text-brand-ink" : "bg-zinc-100 text-zinc-600")}>
            {auto ? <Zap className="size-5" /> : <Hand className="size-5" />}
          </div>
          <div className="flex-1">
            <p className="font-semibold">Confirmación automática</p>
            <p className="mt-0.5 text-sm text-muted">
              {auto
                ? "Las citas en línea se confirman solas al reservar."
                : "Las citas en línea llegan “por confirmar” y tú las apruebas. Su lugar queda apartado mientras tanto."}
            </p>
          </div>
          <Interruptor activo={auto} onCambio={cambiarAuto} etiqueta="Confirmación automática" />
        </Tarjeta>

        <Tarjeta className="divide-y divide-line">
          <div className={fila}>
            <div>
              <p className="font-medium">Bahías de trabajo</p>
              <p className="text-sm text-muted">Autos que pueden quedarse en reparación a la vez.</p>
            </div>
            <Numero valor={f.bahias_total} onCambio={(n) => setF({ ...f, bahias_total: n })} max={200} />
          </div>
          <div className={fila}>
            <div>
              <p className="font-medium">Recepciones por bloque</p>
              <p className="text-sm text-muted">Autos que puedes recibir en el mismo horario.</p>
            </div>
            <Numero valor={f.cupo_por_bloque} onCambio={(n) => setF({ ...f, cupo_por_bloque: n })} max={50} />
          </div>
          <div className={fila}>
            <div>
              <p className="font-medium">Duración del bloque</p>
              <p className="text-sm text-muted">Cada cuánto se ofrece un horario de llegada.</p>
            </div>
            <Selector value={f.intervalo_min} onChange={(e) => setF({ ...f, intervalo_min: Number(e.target.value) })} className="w-40">
              {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </Selector>
          </div>
          <div className={fila}>
            <div>
              <p className="font-medium">Reservas con anticipación</p>
              <p className="text-sm text-muted">Hasta cuántos días adelante pueden reservar.</p>
            </div>
            <Numero valor={f.dias_anticipacion_max} onCambio={(n) => setF({ ...f, dias_anticipacion_max: n })} max={180} sufijo="días" />
          </div>
          <div className="flex justify-end p-4">
            <Boton onClick={guardar} cargando={guardando} variante="oscuro">
              Guardar capacidad
            </Boton>
          </div>
        </Tarjeta>
      </div>
    </Seccion>
  );
}

/* Horario ------------------------------------------------------------------------- */
function SeccionHorario() {
  const { taller } = usePanel();
  const avisar = useAvisos();
  const [dias, setDias] = useState<DiaHorario[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .from("horario_taller")
      .select("dia_semana,abre,cierra")
      .eq("taller_id", taller.id)
      .then(({ data }) => setDias(horarioAEditor((data ?? []) as Horario[])));
  }, [taller.id]);

  async function guardar() {
    if (!dias) return;
    setError(null);
    const err = horarioValido(dias);
    if (err) return setError(err);
    setGuardando(true);
    try {
      const sb = supabase();
      const { error: e1 } = await sb.from("horario_taller").delete().eq("taller_id", taller.id);
      if (e1) throw e1;
      const { error: e2 } = await sb.from("horario_taller").insert(editorAHorario(dias).map((h) => ({ ...h, taller_id: taller.id })));
      if (e2) throw e2;
      avisar("Horario guardado");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion id="horario" titulo="Horario de atención" descripcion={`El último horario de llegada es ${taller.intervalo_min} minutos antes del cierre.`}>
      {!dias ? (
        <Cargando />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white">
            <EditorHorario dias={dias} onCambio={setDias} />
          </div>
          {error && <Aviso tono="error">{error}</Aviso>}
          <div className="flex justify-end">
            <Boton onClick={guardar} cargando={guardando} variante="oscuro">
              Guardar horario
            </Boton>
          </div>
        </div>
      )}
    </Seccion>
  );
}

/* Bloqueos ------------------------------------------------------------------------ */
function Bloqueos() {
  const { taller } = usePanel();
  const tz = taller.zona_horaria;
  const avisar = useAvisos();
  const hoy = hoyClave(tz);
  const [lista, setLista] = useState<Bloqueo[] | null>(null);
  const [dia, setDia] = useState(hoy);
  const [diaFin, setDiaFin] = useState(hoy);
  const [todoElDia, setTodoElDia] = useState(true);
  const [desde, setDesde] = useState("09:00");
  const [hasta, setHasta] = useState("14:00");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    supabase()
      .from("bloqueos")
      .select("id,inicio,fin,motivo")
      .eq("taller_id", taller.id)
      .gte("fin", new Date().toISOString())
      .order("inicio")
      .then(({ data }) => setLista((data ?? []) as Bloqueo[]));
  }, [taller.id]);
  useEffect(cargar, [cargar]);

  async function agregar() {
    const fin = todoElDia ? sumarDias(diaFin < dia ? dia : diaFin, 1) : dia;
    const inicio = aInstante(dia, todoElDia ? "00:00" : desde, tz);
    const termino = aInstante(fin, todoElDia ? "00:00" : hasta, tz);
    if (termino <= inicio) return avisar("La hora final debe ser después de la inicial.", "error");
    setGuardando(true);
    const { error } = await supabase().from("bloqueos").insert({ taller_id: taller.id, inicio, fin: termino, motivo: motivo.trim() || null });
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    setMotivo("");
    avisar("Bloqueo agregado");
    cargar();
  }

  async function quitar(id: string) {
    const { error } = await supabase().from("bloqueos").delete().eq("id", id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  function describir(b: Bloqueo) {
    const d1 = diaClave(b.inicio, tz);
    const finMenos = new Date(new Date(b.fin).getTime() - 1).toISOString();
    const d2 = diaClave(finMenos, tz);
    const completo = hora24(b.inicio, tz) === "00:00" && hora24(b.fin, tz) === "00:00";
    if (completo) return d1 === d2 ? `${fechaCorta(d1)} · todo el día` : `${fechaCorta(d1)} al ${fechaCorta(d2)}`;
    return `${fechaCorta(d1)} · ${hora(b.inicio, tz)} a ${hora(b.fin, tz)}`;
  }

  return (
    <Seccion id="bloqueos" titulo="Días bloqueados" descripcion="Vacaciones, días festivos o inventario: en esos horarios no se ofrecen citas.">
      <div className="space-y-4">
        <Tarjeta className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Interruptor activo={todoElDia} onCambio={setTodoElDia} etiqueta="Todo el día" />
            <span className="text-sm font-medium">Días completos</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta={todoElDia ? "Desde el día" : "Día"}>
              <Entrada type="date" min={hoy} value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
            </Campo>
            {todoElDia ? (
              <Campo etiqueta="Hasta el día">
                <Entrada type="date" min={dia} value={diaFin < dia ? dia : diaFin} onChange={(e) => e.target.value && setDiaFin(e.target.value)} />
              </Campo>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Campo etiqueta="De">
                  <Entrada type="time" step={900} value={desde} onChange={(e) => setDesde(e.target.value)} />
                </Campo>
                <Campo etiqueta="A">
                  <Entrada type="time" step={900} value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </Campo>
              </div>
            )}
          </div>
          <Campo etiqueta="Motivo (opcional, solo lo ve tu equipo)">
            <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Día festivo" />
          </Campo>
          <div className="flex justify-end">
            <Boton onClick={agregar} cargando={guardando} variante="oscuro" icono={<Plus className="size-4" />}>
              Bloquear
            </Boton>
          </div>
        </Tarjeta>

        {lista === null ? null : lista.length === 0 ? (
          <Tarjeta>
            <Vacio icono={<CalendarOff className="size-6" />} titulo="Sin bloqueos próximos" />
          </Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-line">
            {lista.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <CalendarOff className="size-4 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{mayus(describir(b))}</p>
                  {b.motivo && <p className="text-sm text-muted">{b.motivo}</p>}
                </div>
                <button onClick={() => quitar(b.id)} className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Quitar bloqueo">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </Tarjeta>
        )}
      </div>
    </Seccion>
  );
}
