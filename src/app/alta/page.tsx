"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, KeyRound, Store, Zap, Hand } from "lucide-react";
import { Aviso, Boton, Campo, Cargando, Entrada, Interruptor, Logo, Numero, Selector, Tarjeta, cx } from "@/components/ui";
import { EditorHorario, editorAHorario, horarioValido } from "@/components/editor-horario";
import type { DiaHorario } from "@/components/editor-horario";
import { mensajeError, supabase } from "@/lib/supabase";

const HORARIO_INICIAL: DiaHorario[] = [
  ...Array.from({ length: 5 }, () => ({ abierto: true, abre: "09:00", cierra: "18:00" })),
  { abierto: true, abre: "09:00", cierra: "14:00" },
  { abierto: false, abre: "09:00", cierra: "14:00" },
];

function aSlug(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function Alta() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [modo, setModo] = useState<"elegir" | "nuevo" | "codigo">("elegir");
  const [paso, setPaso] = useState(1);
  const [tallerId, setTallerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [slugLibre, setSlugLibre] = useState<boolean | null>(null);
  // Paso 2
  const [bahias, setBahias] = useState(4);
  const [cupo, setCupo] = useState(2);
  const [intervalo, setIntervalo] = useState(30);
  const [dias, setDias] = useState<DiaHorario[]>(HORARIO_INICIAL);
  // Paso 3
  const [auto, setAuto] = useState(false);
  // Código
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session) router.replace("/entrar?siguiente=/alta");
        else setListo(true);
      });
  }, [router]);

  const slugFinal = useMemo(() => aSlug(slugEditado ? slug : nombre), [slug, slugEditado, nombre]);

  useEffect(() => {
    if (!slugFinal) return setSlugLibre(null);
    const t = setTimeout(async () => {
      const { data } = await supabase().rpc("slug_disponible", { p_slug: slugFinal });
      setSlugLibre(Boolean(data));
    }, 350);
    return () => clearTimeout(t);
  }, [slugFinal]);

  async function crear() {
    setError(null);
    if (nombre.trim().length < 2) return setError("Escribe el nombre del taller.");
    if (!slugFinal || slugLibre === false) return setError("Elige otra dirección para tu página.");
    const tel = telefono.replace(/\D/g, "");
    if (tel && tel.length !== 10) return setError("El teléfono debe tener 10 dígitos.");
    setCargando(true);
    try {
      const sb = supabase();
      if (!tallerId) {
        const { data, error } = await sb.rpc("crear_taller", { p_nombre: nombre.trim(), p_slug: slugFinal });
        if (error) throw error;
        setTallerId(data as string);
        if (tel) await sb.from("talleres").update({ telefono: tel }).eq("id", data);
      } else {
        const { error } = await sb.from("talleres").update({ nombre: nombre.trim(), telefono: tel || null }).eq("id", tallerId);
        if (error) throw error;
      }
      setPaso(2);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  async function guardarCapacidad() {
    setError(null);
    const err = horarioValido(dias);
    if (err) return setError(err);
    setCargando(true);
    try {
      const sb = supabase();
      const { error } = await sb.from("talleres").update({ bahias_total: bahias, cupo_por_bloque: cupo, intervalo_min: intervalo }).eq("id", tallerId);
      if (error) throw error;
      const { error: e2 } = await sb.from("horario_taller").delete().eq("taller_id", tallerId);
      if (e2) throw e2;
      const { error: e3 } = await sb.from("horario_taller").insert(editorAHorario(dias).map((h) => ({ ...h, taller_id: tallerId })));
      if (e3) throw e3;
      setPaso(3);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  async function terminar() {
    setCargando(true);
    setError(null);
    const { error } = await supabase().from("talleres").update({ confirmacion_automatica: auto }).eq("id", tallerId);
    setCargando(false);
    if (error) return setError(mensajeError(error));
    localStorage.setItem("taller_activo", tallerId!);
    router.replace("/panel?bienvenida=1");
  }

  async function reclamar() {
    setError(null);
    setCargando(true);
    const { data, error } = await supabase().rpc("reclamar_taller", { p_codigo: codigo });
    setCargando(false);
    if (error) return setError(mensajeError(error));
    localStorage.setItem("taller_activo", data as string);
    router.replace("/panel?bienvenida=1");
  }

  if (!listo) return <Cargando />;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/panel" className="text-sm font-medium text-muted hover:text-zinc-900">
          Ir al panel
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-16">
        {modo === "elegir" && (
          <div className="aparecer pt-6">
            <h1 className="text-[28px] font-semibold tracking-tight">Vamos a preparar tu taller</h1>
            <p className="mt-1.5 text-[15px] text-muted">Elige cómo quieres empezar.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button onClick={() => setModo("nuevo")} className="rounded-2xl bg-white p-5 text-left ring-1 ring-line transition hover:ring-zinc-400">
                <Store className="size-6 text-brand" />
                <p className="mt-4 font-semibold">Registrar mi taller</p>
                <p className="mt-1 text-sm text-muted">Configura nombre, bahías y horario. 30 días gratis.</p>
              </button>
              <button onClick={() => setModo("codigo")} className="rounded-2xl bg-white p-5 text-left ring-1 ring-line transition hover:ring-zinc-400">
                <KeyRound className="size-6 text-zinc-700" />
                <p className="mt-4 font-semibold">Tengo un código de acceso</p>
                <p className="mt-1 text-sm text-muted">Tu taller ya está cargado y te dieron un código.</p>
              </button>
            </div>
          </div>
        )}

        {modo === "codigo" && (
          <div className="aparecer pt-6">
            <button onClick={() => setModo("elegir")} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-zinc-900">
              <ArrowLeft className="size-4" /> Atrás
            </button>
            <h1 className="text-[28px] font-semibold tracking-tight">Código de acceso</h1>
            <p className="mt-1.5 text-[15px] text-muted">Escríbelo tal como te lo dieron.</p>
            <Tarjeta className="mt-6 space-y-4 p-5">
              <Campo etiqueta="Código">
                <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="MYRAC-XXXX-XXXX" className="font-mono tracking-wider" />
              </Campo>
              {error && <Aviso tono="error">{error}</Aviso>}
              <Boton onClick={reclamar} cargando={cargando} disabled={codigo.trim().length < 4} className="w-full" variante="oscuro">
                Entrar a mi taller
              </Boton>
            </Tarjeta>
          </div>
        )}

        {modo === "nuevo" && (
          <div className="pt-2">
            <div className="mb-8 flex items-center gap-2">
              {["Tu taller", "Capacidad y horario", "Confirmación"].map((t, i) => (
                <div key={t} className="flex flex-1 flex-col gap-2">
                  <div className={cx("h-1.5 rounded-full", i + 1 <= paso ? "bg-brand" : "bg-zinc-200")} />
                  <span className={cx("text-xs font-medium", i + 1 === paso ? "text-zinc-900" : "text-zinc-400")}>{t}</span>
                </div>
              ))}
            </div>

            {paso === 1 && (
              <div className="aparecer">
                <h1 className="text-[26px] font-semibold tracking-tight">¿Cómo se llama tu taller?</h1>
                <p className="mt-1 text-[15px] text-muted">Así lo verán tus clientes en tu página de citas.</p>
                <Tarjeta className="mt-6 space-y-4 p-5">
                  <Campo etiqueta="Nombre del taller">
                    <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Taller Mecánico López" autoFocus />
                  </Campo>
                  <Campo
                    etiqueta="Dirección de tu página"
                    error={slugLibre === false ? "Esa dirección no está disponible." : null}
                    ayuda={slugLibre ? "Disponible." : "Solo letras, números y guiones."}
                  >
                    <div className="flex h-11 items-center overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-brand">
                      <span className="pl-3.5 text-[15px] text-zinc-400">{window.location.host}/</span>
                      <input
                        value={slugFinal}
                        onChange={(e) => {
                          setSlugEditado(true);
                          setSlug(e.target.value);
                        }}
                        className="h-full flex-1 bg-transparent pr-3 text-[15px] outline-none"
                        placeholder="mi-taller"
                      />
                      {slugLibre && <Check className="mr-3 size-4 text-emerald-600" />}
                    </div>
                  </Campo>
                  <Campo etiqueta="Teléfono / WhatsApp del taller" ayuda="Opcional. Se muestra a tus clientes.">
                    <Entrada inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="443 123 4567" />
                  </Campo>
                  {error && <Aviso tono="error">{error}</Aviso>}
                  <Boton onClick={crear} cargando={cargando} className="w-full" tam="lg" variante="oscuro">
                    Continuar
                  </Boton>
                </Tarjeta>
              </div>
            )}

            {paso === 2 && (
              <div className="aparecer">
                <h1 className="text-[26px] font-semibold tracking-tight">Capacidad y horario</h1>
                <p className="mt-1 text-[15px] text-muted">Con esto calculamos los horarios que se ofrecen a tus clientes.</p>
                <Tarjeta className="mt-6 divide-y divide-line">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <p className="font-medium">Bahías de trabajo</p>
                      <p className="text-sm text-muted">Lugares donde un auto puede quedarse en reparación.</p>
                    </div>
                    <Numero valor={bahias} onCambio={setBahias} min={1} max={200} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <p className="font-medium">Autos que recibes a la vez</p>
                      <p className="text-sm text-muted">Cuántas recepciones caben en cada bloque.</p>
                    </div>
                    <Numero valor={cupo} onCambio={setCupo} min={1} max={50} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <p className="font-medium">Bloques de horario</p>
                      <p className="text-sm text-muted">Cada cuánto se puede agendar una llegada.</p>
                    </div>
                    <Selector value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} className="w-40">
                      {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                        <option key={m} value={m}>
                          Cada {m} min
                        </option>
                      ))}
                    </Selector>
                  </div>
                </Tarjeta>
                <h2 className="mb-3 mt-8 font-semibold">Horario de atención</h2>
                <EditorHorario dias={dias} onCambio={setDias} />
                {error && <Aviso tono="error" className="mt-4">{error}</Aviso>}
                <div className="mt-6 flex gap-2">
                  <Boton variante="secundario" tam="lg" onClick={() => setPaso(1)}>
                    Atrás
                  </Boton>
                  <Boton onClick={guardarCapacidad} cargando={cargando} className="flex-1" tam="lg" variante="oscuro">
                    Continuar
                  </Boton>
                </div>
              </div>
            )}

            {paso === 3 && (
              <div className="aparecer">
                <h1 className="text-[26px] font-semibold tracking-tight">¿Cómo quieres confirmar las citas?</h1>
                <p className="mt-1 text-[15px] text-muted">Puedes cambiarlo cuando quieras en Configuración.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setAuto(false)}
                    className={cx("rounded-2xl bg-white p-5 text-left ring-1 transition", !auto ? "ring-2 ring-brand" : "ring-line hover:ring-zinc-400")}
                  >
                    <Hand className="size-6 text-zinc-700" />
                    <p className="mt-4 font-semibold">Confirmo yo cada cita</p>
                    <p className="mt-1 text-sm text-muted">Las citas llegan “por confirmar” y tú las apruebas. El lugar queda apartado mientras tanto.</p>
                  </button>
                  <button
                    onClick={() => setAuto(true)}
                    className={cx("rounded-2xl bg-white p-5 text-left ring-1 transition", auto ? "ring-2 ring-brand" : "ring-line hover:ring-zinc-400")}
                  >
                    <Zap className="size-6 text-brand" />
                    <p className="mt-4 font-semibold">Confirmación automática</p>
                    <p className="mt-1 text-sm text-muted">El cliente recibe su cita confirmada al instante. Ideal cuando tu capacidad ya está bien configurada.</p>
                  </button>
                </div>
                <Tarjeta className="mt-4 flex items-center gap-4 p-4">
                  <Zap className="size-5 shrink-0 text-brand" />
                  <p className="flex-1 text-sm text-zinc-700">
                    <span className="font-medium">Sugerencia:</span> empieza confirmando a mano unos días; cuando veas que tus horarios y bahías están
                    bien ajustados, activa la confirmación automática y ahórrate ese paso.
                  </p>
                  <Interruptor activo={auto} onCambio={setAuto} etiqueta="Confirmación automática" />
                </Tarjeta>
                {error && <Aviso tono="error" className="mt-4">{error}</Aviso>}
                <div className="mt-6 flex gap-2">
                  <Boton variante="secundario" tam="lg" onClick={() => setPaso(2)}>
                    Atrás
                  </Boton>
                  <Boton onClick={terminar} cargando={cargando} className="flex-1" tam="lg">
                    Terminar y abrir mi panel
                  </Boton>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
