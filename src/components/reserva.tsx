"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Car, ChevronRight, Search, Wrench } from "lucide-react";
import { MarcoPublico } from "@/components/marco-publico";
import { SelectorHorario } from "@/components/selector-horario";
import { Area, Aviso, Boton, Campo, Cargando, Entrada, Tarjeta, Vacio, cx } from "@/components/ui";
import { diaClave, enlaceWhatsApp, fechaLarga, hora, mayus } from "@/lib/fechas";
import { mensajeError, supabase } from "@/lib/supabase";
import type { Categoria, Servicio, TallerPublico } from "@/lib/tipos";

type Paso = "servicio" | "horario" | "datos";

export function Reserva({ slug }: { slug: string }) {
  const router = useRouter();
  const [taller, setTaller] = useState<TallerPublico | null | undefined>(undefined);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [paso, setPaso] = useState<Paso>("servicio");
  const [busqueda, setBusqueda] = useState("");
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", marca: "", modelo: "", anio: "", placas: "", notas: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data } = await sb.rpc("taller_publico", { p_slug: slug });
      const t = (data as TallerPublico[] | null)?.[0] ?? null;
      setTaller(t);
      if (!t) return;
      const [c, s] = await Promise.all([
        sb.from("categorias_servicio").select("id,nombre,orden").eq("taller_id", t.id).order("orden"),
        sb.from("servicios").select("id,categoria_id,nombre,tipo,activo,orden").eq("taller_id", t.id).eq("activo", true).order("orden"),
      ]);
      setCategorias((c.data ?? []) as Categoria[]);
      setServicios((s.data ?? []) as Servicio[]);
    })();
  }, [slug]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paso]);

  const grupos = useMemo(() => {
    const q = busqueda
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    const coincide = (s: Servicio) =>
      !q ||
      s.nombre
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(q);
    return [...categorias, { id: "", nombre: "Otros servicios", orden: 999 }]
      .map((c) => ({ ...c, lista: servicios.filter((s) => (s.categoria_id ?? "") === c.id && coincide(s)) }))
      .filter((c) => c.lista.length);
  }, [categorias, servicios, busqueda]);

  if (taller === undefined) return <Cargando className="min-h-dvh" />;
  if (taller === null)
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <Vacio icono={<Wrench className="size-6" />} titulo="No encontramos este taller" texto="Revisa que el enlace esté bien escrito." />
      </div>
    );

  const tz = taller.zona_horaria;

  async function reservar() {
    setError(null);
    if (!f.nombre.trim() || !f.marca.trim() || !f.modelo.trim()) return setError("Completa tu nombre, la marca y el modelo del auto.");
    if (f.telefono.replace(/\D/g, "").length !== 10) return setError("Escribe tu teléfono a 10 dígitos.");
    setEnviando(true);
    const { data, error } = await supabase().rpc("crear_cita_publica", {
      p_slug: slug,
      p_servicio_id: servicio!.id,
      p_inicio: inicio,
      p_nombre: f.nombre,
      p_telefono: f.telefono,
      p_email: f.email || null,
      p_marca: f.marca,
      p_modelo: f.modelo,
      p_anio: f.anio ? Number(f.anio) : null,
      p_placas: f.placas || null,
      p_notas: f.notas || null,
    });
    if (error) {
      setEnviando(false);
      setError(mensajeError(error));
      if (String(error.message).includes("HORARIO_NO_DISPONIBLE")) {
        setInicio(null);
        setPaso("horario");
      }
      return;
    }
    const fila = (data as { token: string }[])[0];
    router.push(`/cita/${fila.token}?nueva=1`);
  }

  if (!taller.acepta_citas)
    return (
      <MarcoPublico taller={taller}>
        <Tarjeta className="p-6 text-center">
          <p className="font-semibold">Este taller no está recibiendo citas en línea por ahora</p>
          <p className="mt-1 text-sm text-muted">Comunícate directamente para agendar.</p>
          {taller.telefono && (
            <a href={enlaceWhatsApp(taller.telefono)} className="mt-4 inline-flex h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white">
              Escribir por WhatsApp
            </a>
          )}
        </Tarjeta>
      </MarcoPublico>
    );

  const pasos: Paso[] = ["servicio", "horario", "datos"];
  const idx = pasos.indexOf(paso);

  return (
    <MarcoPublico taller={taller}>
      {/* Progreso */}
      <div className="mb-5 flex items-center gap-2">
        {["Servicio", "Fecha y hora", "Tus datos"].map((t, i) => (
          <div key={t} className="flex flex-1 flex-col gap-1.5">
            <div className={cx("h-1 rounded-full transition", i <= idx ? "bg-brand" : "bg-zinc-200")} />
            <span className={cx("text-xs font-medium", i === idx ? "text-zinc-900" : "text-zinc-400")}>{t}</span>
          </div>
        ))}
      </div>

      {idx > 0 && (
        <button onClick={() => setPaso(pasos[idx - 1])} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-zinc-900">
          <ArrowLeft className="size-4" /> Atrás
        </button>
      )}

      {/* Resumen de lo elegido */}
      {idx > 0 && servicio && (
        <Tarjeta className="mb-4 divide-y divide-line">
          <button onClick={() => setPaso("servicio")} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <Wrench className="size-4 text-brand" />
            <span className="flex-1 text-[15px] font-medium">{servicio.nombre}</span>
            <span className="text-sm text-muted">Cambiar</span>
          </button>
          {idx > 1 && inicio && (
            <button onClick={() => setPaso("horario")} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <CalendarClock className="size-4 text-brand" />
              <span className="flex-1 text-[15px] font-medium">
                {mayus(fechaLarga(diaClave(inicio, tz)))}, {hora(inicio, tz)}
              </span>
              <span className="text-sm text-muted">Cambiar</span>
            </button>
          )}
        </Tarjeta>
      )}

      {paso === "servicio" && (
        <div className="aparecer">
          <h2 className="text-xl font-semibold tracking-tight">¿Qué necesita tu auto?</h2>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar servicio (frenos, aceite, escáner…)" className="pl-10" />
          </div>
          <div className="mt-4 space-y-4">
            {grupos.map((g) => (
              <div key={g.id || "otros"}>
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.nombre}</p>
                <Tarjeta className="divide-y divide-line overflow-hidden">
                  {g.lista.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setServicio(s);
                        setInicio(null);
                        setPaso("horario");
                      }}
                      className={cx("flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-50", servicio?.id === s.id && "bg-zinc-50")}
                    >
                      <span className="flex-1 text-[15px]">{s.nombre}</span>
                      <ChevronRight className="size-4 text-zinc-300" />
                    </button>
                  ))}
                </Tarjeta>
              </div>
            ))}
            {grupos.length === 0 && <Vacio titulo="Sin resultados" texto="Prueba con otra palabra o elige “Diagnóstico” si no sabes qué tiene tu auto." />}
          </div>
        </div>
      )}

      {paso === "horario" && servicio && (
        <div className="aparecer">
          <h2 className="text-xl font-semibold tracking-tight">¿Cuándo llevas tu auto?</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {servicio.tipo === "deja_auto"
              ? "Elige la hora de llegada. Tu auto se queda en el taller durante el servicio."
              : "Elige la hora de llegada. Puedes esperar mientras se realiza el servicio."}
          </p>
          <Tarjeta className="p-4 sm:p-5">
            <SelectorHorario
              slug={slug}
              servicioId={servicio.id}
              tz={tz}
              diasMax={taller.dias_anticipacion_max}
              valor={inicio}
              onElegir={(i) => {
                setInicio(i);
                setPaso("datos");
              }}
            />
          </Tarjeta>
        </div>
      )}

      {paso === "datos" && servicio && inicio && (
        <div className="aparecer">
          <h2 className="text-xl font-semibold tracking-tight">Tus datos</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Para confirmarte la cita y saber qué auto llega.</p>
          <Tarjeta className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre">
                <Entrada value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} autoComplete="name" placeholder="Nombre y apellido" />
              </Campo>
              <Campo etiqueta="Teléfono / WhatsApp">
                <Entrada value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="10 dígitos" />
              </Campo>
            </div>
            <Campo etiqueta="Correo (opcional)">
              <Entrada type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
            </Campo>
            <div className="flex items-center gap-2 pt-2 text-sm font-semibold">
              <Car className="size-4 text-brand" /> Tu auto
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Campo etiqueta="Marca">
                <Entrada value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} placeholder="Nissan" />
              </Campo>
              <Campo etiqueta="Modelo">
                <Entrada value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} placeholder="Versa" />
              </Campo>
              <Campo etiqueta="Año">
                <Entrada inputMode="numeric" maxLength={4} value={f.anio} onChange={(e) => setF({ ...f, anio: e.target.value.replace(/\D/g, "") })} placeholder="2020" />
              </Campo>
              <Campo etiqueta="Placas (opcional)">
                <Entrada value={f.placas} onChange={(e) => setF({ ...f, placas: e.target.value.toUpperCase() })} className="font-mono" />
              </Campo>
            </div>
            <Campo etiqueta="¿Algo que debamos saber? (opcional)">
              <Area value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} placeholder="Ruidos, testigos encendidos, cuándo empezó la falla…" />
            </Campo>
            {error && <Aviso tono="error">{error}</Aviso>}
            <Boton onClick={reservar} cargando={enviando} tam="lg" className="w-full">
              {taller.confirmacion_automatica ? "Confirmar cita" : "Solicitar cita"}
            </Boton>
            {!taller.confirmacion_automatica && (
              <p className="text-center text-xs text-muted">Tu lugar queda apartado. El taller confirmará tu cita.</p>
            )}
          </Tarjeta>
        </div>
      )}
    </MarcoPublico>
  );
}
