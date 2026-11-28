"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Pause,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Aviso, Boton, Campo, Cargando, Entrada, Insignia, Logo, Modal, ProveedorAvisos, Selector, Tarjeta, Vacio, cx, useAvisos } from "@/components/ui";
import { LogoTaller } from "@/components/logo-taller";
import { supabase } from "@/lib/supabase";

type Taller = {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_marca: string;
  telefono: string | null;
  creado_en: string;
  estado: string | null;
  plan_id: string | null;
  vence_en: string | null;
  mp_estado: string | null;
  fundador: boolean;
  duenos: string | null;
  miembros: number;
  citas_30d: number;
  citas_total: number;
  ultima_cita: string | null;
};
type Pago = { id: string; taller_id: string; monto: number | null; moneda: string | null; estado: string | null; fecha: string | null };
type Admin = { auth_user_id: string; email: string; nombre: string; creado_en: string };
type Registro = { id: number; admin_id: string; accion: string; taller_id: string | null; detalle: Record<string, unknown> | null; creado_en: string };
type Datos = {
  yo: { id: string; email: string | null };
  metricas: Record<string, number>;
  lugares_fundador: number | null;
  talleres: Taller[];
  pagos: Pago[];
  admins: Admin[];
  bitacora: Registro[];
};

const ACCIONES: Record<string, string> = {
  extender_prueba: "Extendió la prueba",
  cortesia: "Activó cortesía",
  pausar: "Pausó el servicio",
  fundador_si: "Asignó precio fundador",
  fundador_no: "Quitó precio fundador",
  codigo_alta: "Generó código de acceso",
  crear_taller: "Creó un taller",
  agregar_admin: "Agregó un admin",
  quitar_admin: "Quitó un admin",
};

async function llamar(ruta: string, metodo: "GET" | "POST", cuerpo?: object) {
  const { data } = await supabase().auth.getSession();
  if (!data.session) throw Object.assign(new Error("SIN_SESION"), { codigo: 401 });
  const r = await fetch(ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? "Error"), { codigo: r.status });
  return j;
}

function fecha(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
const dinero = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

function estadoTaller(t: Taller) {
  const vigente = (t.estado === "prueba" || t.estado === "activa") && (!t.vence_en || new Date(t.vence_en) > new Date());
  if (!vigente) return { etiqueta: "Pausado", clase: "bg-rose-50 text-rose-700 ring-rose-200", clave: "pausado" };
  if (t.mp_estado === "authorized") return { etiqueta: "Pagando", clase: "bg-emerald-50 text-emerald-700 ring-emerald-200", clave: "pagando" };
  if (t.estado === "prueba") return { etiqueta: "En prueba", clase: "bg-sky-50 text-sky-700 ring-sky-200", clave: "prueba" };
  if (t.mp_estado === "cancelled") return { etiqueta: "Canceló", clase: "bg-amber-50 text-amber-800 ring-amber-200", clave: "cancelo" };
  return { etiqueta: "Cortesía", clase: "bg-violet-50 text-violet-700 ring-violet-200", clave: "cortesia" };
}

export default function AdminPagina() {
  return (
    <ProveedorAvisos>
      <Admin />
    </ProveedorAvisos>
  );
}

function Admin() {
  const avisar = useAvisos();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<"sin_sesion" | "sin_permiso" | "otro" | null>(null);
  const [pestana, setPestana] = useState<"talleres" | "pagos" | "admins" | "bitacora">("talleres");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [abierto, setAbierto] = useState<Taller | null>(null);
  const [crear, setCrear] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamar("/api/admin/resumen", "GET"));
      setError(null);
    } catch (e) {
      const codigo = (e as { codigo?: number }).codigo;
      setError(codigo === 401 ? "sin_sesion" : codigo === 403 ? "sin_permiso" : "otro");
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const talleres = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return (datos?.talleres ?? []).filter(
      (t) =>
        (filtro === "todos" || estadoTaller(t).clave === filtro) &&
        (!q || [t.nombre, t.slug, t.duenos ?? ""].some((x) => x.toLowerCase().includes(q))),
    );
  }, [datos, busqueda, filtro]);

  if (error === "sin_sesion")
    return (
      <Centro>
        <Vacio icono={<ShieldCheck className="size-6" />} titulo="Inicia sesión para entrar al admin" accion={<Link href="/entrar?siguiente=/admin" className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white">Entrar</Link>} />
      </Centro>
    );
  if (error === "sin_permiso")
    return (
      <Centro>
        <Vacio icono={<ShieldCheck className="size-6" />} titulo="Tu cuenta no es administradora de la plataforma" accion={<Link href="/panel" className="text-sm font-medium text-zinc-700 hover:underline">Ir a mi panel</Link>} />
      </Centro>
    );
  if (error === "otro")
    return (
      <Centro>
        <Vacio titulo="No se pudo cargar el admin" accion={<Boton onClick={cargar} variante="secundario">Reintentar</Boton>} />
      </Centro>
    );
  if (!datos) return <Cargando className="min-h-dvh" />;

  const m = datos.metricas;
  const nombreTaller = (id: string | null) => datos.talleres.find((t) => t.id === id)?.nombre ?? "—";

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <Logo claro className="text-white" />
            <span className="rounded-full bg-[#E11D2E] px-2.5 py-0.5 text-xs font-semibold">Admin plataforma</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="hidden sm:inline">{datos.yo.email}</span>
            <Link href="/panel" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-300 hover:bg-white/10">
              <ArrowLeft className="size-4" /> Mi panel
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">MYRAC Appointments</h1>
            <p className="text-[15px] text-muted">Talleres, suscripciones y actividad de la plataforma.</p>
          </div>
          <div className="flex gap-2">
            <Boton variante="secundario" icono={<RefreshCw className="size-4" />} onClick={cargar}>
              Actualizar
            </Boton>
            <Boton variante="oscuro" icono={<Plus className="size-4" />} onClick={() => setCrear(true)}>
              Precargar taller
            </Boton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Metrica icono={<TrendingUp className="size-4" />} titulo="Ingreso mensual" valor={dinero(m.ingreso_mensual)} destacado className="col-span-2" nota="Suscripciones activas con Mercado Pago" />
          <Metrica icono={<Store className="size-4" />} titulo="Talleres" valor={m.talleres} nota={`+${m.nuevos_7d} esta semana`} />
          <Metrica icono={<CreditCard className="size-4" />} titulo="Pagando" valor={m.pagando} />
          <Metrica icono={<Sparkles className="size-4" />} titulo="En prueba" valor={m.en_prueba} />
          <Metrica icono={<BadgeCheck className="size-4" />} titulo="Cortesía" valor={m.cortesia} />
          <Metrica icono={<Pause className="size-4" />} titulo="Pausados" valor={m.pausados} />
          <Metrica icono={<Star className="size-4" />} titulo="Fundadores" valor={`${m.fundadores}/15`} />
        </div>
        <p className="mt-3 text-sm text-muted">
          {m.citas_30d.toLocaleString("es-MX")} citas en los últimos 30 días en toda la plataforma.
        </p>

        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
          {(
            [
              ["talleres", "Talleres", datos.talleres.length],
              ["pagos", "Pagos", datos.pagos.length],
              ["admins", "Administradores", datos.admins.length],
              ["bitacora", "Bitácora", null],
            ] as const
          ).map(([k, t, n]) => (
            <button
              key={k}
              onClick={() => setPestana(k)}
              className={cx("-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium", pestana === k ? "border-zinc-900 text-zinc-900" : "border-transparent text-muted hover:text-zinc-800")}
            >
              {t}
              {n !== null && <span className="ml-1.5 text-xs text-zinc-400">{n}</span>}
            </button>
          ))}
        </div>

        {pestana === "talleres" && (
          <div className="mt-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="relative min-w-60 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por taller, dirección o correo del dueño" className="pl-10" />
              </div>
              <Selector value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-44">
                <option value="todos">Todos</option>
                <option value="pagando">Pagando</option>
                <option value="prueba">En prueba</option>
                <option value="cortesia">Cortesía</option>
                <option value="cancelo">Cancelaron</option>
                <option value="pausado">Pausados</option>
              </Selector>
            </div>
            <Tarjeta className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Taller</th>
                    <th className="px-4 py-3 font-medium">Dueño</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Vence</th>
                    <th className="px-4 py-3 text-right font-medium">Citas 30 d</th>
                    <th className="px-4 py-3 font-medium">Alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {talleres.map((t) => {
                    const e = estadoTaller(t);
                    return (
                      <tr key={t.id} onClick={() => setAbierto(t)} className="cursor-pointer hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3" style={{ ["--brand" as string]: t.color_marca }}>
                            <LogoTaller nombre={t.nombre} logo={t.logo_url} className="size-9 rounded-lg text-sm" />
                            <div>
                              <p className="font-medium">
                                {t.nombre} {t.fundador && <Star className="inline size-3.5 fill-amber-400 text-amber-400" />}
                              </p>
                              <p className="text-xs text-muted">/{t.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{t.duenos ?? <span className="text-amber-700">Sin dueño (código pendiente)</span>}</td>
                        <td className="px-4 py-3">
                          <Insignia className={e.clase}>{e.etiqueta}</Insignia>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted">{t.vence_en ? fecha(t.vence_en) : "Sin vencimiento"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{t.citas_30d}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{fecha(t.creado_en)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {talleres.length === 0 && <Vacio titulo="Sin resultados" />}
            </Tarjeta>
          </div>
        )}

        {pestana === "pagos" && (
          <Tarjeta className="mt-5 divide-y divide-line">
            {datos.pagos.length === 0 ? (
              <Vacio icono={<CreditCard className="size-6" />} titulo="Aún no hay cobros registrados" texto="Aparecen aquí cuando Mercado Pago cobra una suscripción." />
            ) : (
              datos.pagos.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{nombreTaller(p.taller_id)}</span>
                  <span className="text-muted">{fecha(p.fecha)}</span>
                  <span className="tabular-nums">
                    {dinero(Number(p.monto ?? 0))} {p.moneda}
                  </span>
                  <Insignia className={p.estado === "approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}>
                    {p.estado === "approved" ? "Pagado" : p.estado ?? "—"}
                  </Insignia>
                </div>
              ))
            )}
          </Tarjeta>
        )}

        {pestana === "admins" && <Administradores datos={datos} onCambio={cargar} />}

        {pestana === "bitacora" && (
          <Tarjeta className="mt-5 divide-y divide-line">
            {datos.bitacora.length === 0 ? (
              <Vacio titulo="Sin acciones registradas" />
            ) : (
              datos.bitacora.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{ACCIONES[b.accion] ?? b.accion}</span>
                    {b.taller_id && <span className="text-muted"> · {nombreTaller(b.taller_id)}</span>}
                  </span>
                  <span className="text-muted">
                    {datos.admins.find((a) => a.auth_user_id === b.admin_id)?.email ?? "—"} · {fecha(b.creado_en)}
                  </span>
                </div>
              ))
            )}
          </Tarjeta>
        )}
      </main>

      <GestionTaller
        taller={abierto ? (datos.talleres.find((x) => x.id === abierto.id) ?? abierto) : null}
        lugares={datos.lugares_fundador}
        onCerrar={() => setAbierto(null)}
        onCambio={async () => {
          await cargar();
        }}
      />
      <CrearTaller
        abierto={crear}
        onCerrar={() => setCrear(false)}
        onCreado={() => {
          avisar("Taller precargado");
          cargar();
        }}
      />
    </div>
  );
}

function Centro({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center px-6">{children}</div>;
}

function Metrica({ icono, titulo, valor, nota, destacado, className }: { icono: ReactNode; titulo: string; valor: ReactNode; nota?: string; destacado?: boolean; className?: string }) {
  return (
    <Tarjeta className={cx("p-4", destacado && "bg-zinc-950 text-white ring-zinc-900", className)}>
      <div className={cx("flex items-center gap-2 text-sm", destacado ? "text-zinc-400" : "text-muted")}>
        {icono} {titulo}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{valor}</p>
      {nota && <p className={cx("mt-1 text-xs", destacado ? "text-zinc-500" : "text-muted")}>{nota}</p>}
    </Tarjeta>
  );
}

function CodigoGenerado({ codigo }: { codigo: string }) {
  const avisar = useAvisos();
  return (
    <div className="flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-white">
      <KeyRound className="size-4 text-[#E11D2E]" />
      <code className="flex-1 font-mono text-[15px] tracking-wider">{codigo}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(codigo);
          avisar("Código copiado");
        }}
        className="grid size-8 place-items-center rounded-lg hover:bg-white/10"
        aria-label="Copiar código"
      >
        <Copy className="size-4" />
      </button>
    </div>
  );
}

function GestionTaller({ taller, lugares, onCerrar, onCambio }: { taller: Taller | null; lugares: number | null; onCerrar: () => void; onCambio: () => Promise<void> }) {
  const avisar = useAvisos();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [dias, setDias] = useState(15);
  const [hasta, setHasta] = useState("");
  const [rol, setRol] = useState<"dueno" | "recepcion" | "mecanico">("dueno");
  const [codigo, setCodigo] = useState<string | null>(null);
  const id = taller?.id;
  useEffect(() => {
    setCodigo(null);
  }, [id]);

  if (!taller) return null;
  const t = taller;
  const e = estadoTaller(t);

  async function accion(nombre: string, cuerpo: object, exito: string) {
    setOcupado(nombre);
    try {
      const r = await llamar("/api/admin/accion", "POST", { taller_id: t.id, ...cuerpo });
      if (r.codigo) setCodigo(r.codigo);
      avisar(exito);
      await onCambio();
    } catch (err) {
      avisar(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Modal abierto={!!taller} onCerrar={onCerrar} titulo={t.nombre} ancho="max-w-2xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Insignia className={e.clase}>{e.etiqueta}</Insignia>
          {t.fundador && <Insignia className="bg-amber-50 text-amber-800 ring-amber-200">Precio fundador</Insignia>}
          <span className="text-muted">
            /{t.slug} · {t.miembros} {t.miembros === 1 ? "usuario" : "usuarios"} · {t.citas_total} citas en total
          </span>
          <a href={`/${t.slug}`} target="_blank" className="ml-auto inline-flex items-center gap-1 font-medium text-zinc-700 hover:underline">
            Ver página <ExternalLink className="size-3.5" />
          </a>
        </div>
        <div className="grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">Dueño: </span>
            {t.duenos ?? "Sin dueño todavía"}
          </p>
          <p>
            <span className="text-muted">Vence: </span>
            {t.vence_en ? fecha(t.vence_en) : "Sin vencimiento"}
          </p>
          <p>
            <span className="text-muted">Mercado Pago: </span>
            {t.mp_estado ?? "Sin suscripción"}
          </p>
          <p>
            <span className="text-muted">Última cita: </span>
            {fecha(t.ultima_cita)}
          </p>
        </div>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4" /> Extender prueba
          </h3>
          <div className="flex flex-wrap gap-2">
            <Selector value={dias} onChange={(ev) => setDias(Number(ev.target.value))} className="w-36">
              {[7, 15, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </Selector>
            <Boton variante="secundario" cargando={ocupado === "ext"} onClick={() => accion("ext", { accion: "extender_prueba", dias }, `Prueba extendida ${dias} días`)}>
              Extender
            </Boton>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck className="size-4" /> Cortesía (activo sin cobro)
          </h3>
          <p className="text-xs text-muted">Para pilotos o aliados. Deja la fecha vacía para que no venza.</p>
          <div className="flex flex-wrap gap-2">
            <Entrada type="date" value={hasta} onChange={(ev) => setHasta(ev.target.value)} className="w-44" />
            <Boton variante="secundario" cargando={ocupado === "cor"} onClick={() => accion("cor", { accion: "cortesia", hasta: hasta || null }, "Cortesía activada")}>
              Activar cortesía
            </Boton>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4" /> Código de acceso
          </h3>
          <p className="text-xs text-muted">Para que el dueño o alguien del equipo entre a este taller desde /alta.</p>
          <div className="flex flex-wrap gap-2">
            <Selector value={rol} onChange={(ev) => setRol(ev.target.value as typeof rol)} className="w-40">
              <option value="dueno">Dueño</option>
              <option value="recepcion">Recepción</option>
              <option value="mecanico">Mecánico</option>
            </Selector>
            <Boton variante="secundario" cargando={ocupado === "cod"} onClick={() => accion("cod", { accion: "codigo_alta", rol }, "Código generado")}>
              Generar código
            </Boton>
          </div>
          {codigo && <CodigoGenerado codigo={codigo} />}
        </section>

        <section className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Boton
            variante="secundario"
            tam="sm"
            icono={<Star className="size-4" />}
            disabled={!t.fundador && lugares === 0}
            cargando={ocupado === "fun"}
            onClick={() => accion("fun", { accion: "fundador", valor: !t.fundador }, t.fundador ? "Precio fundador retirado" : "Precio fundador asignado")}
          >
            {t.fundador ? "Quitar precio fundador" : `Dar precio fundador${lugares !== null ? ` (${lugares} libres)` : ""}`}
          </Boton>
          {t.mp_estado && (
            <Boton variante="secundario" tam="sm" icono={<RefreshCw className="size-4" />} cargando={ocupado === "sync"} onClick={() => accion("sync", { accion: "sincronizar" }, "Sincronizado con Mercado Pago")}>
              Sincronizar con Mercado Pago
            </Boton>
          )}
          <Boton
            variante="peligro"
            tam="sm"
            icono={<Pause className="size-4" />}
            cargando={ocupado === "pau"}
            onClick={() => confirm(`¿Pausar ${t.nombre}? Su página dejará de recibir citas.`) && accion("pau", { accion: "pausar" }, "Servicio pausado")}
          >
            Pausar servicio
          </Boton>
        </section>
        {t.mp_estado === "authorized" && (
          <Aviso tono="alerta">Este taller paga con Mercado Pago. Pausarlo aquí no cancela sus cobros: cancélalos desde su panel o en Mercado Pago.</Aviso>
        )}
      </div>
    </Modal>
  );
}

function CrearTaller({ abierto, onCerrar, onCreado }: { abierto: boolean; onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const slugAuto = (slug || nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  async function crearlo() {
    setOcupado(true);
    setError(null);
    try {
      const r = await llamar("/api/admin/accion", "POST", { accion: "crear_taller", nombre, slug: slugAuto });
      setCodigo(r.codigo);
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setOcupado(false);
    }
  }

  function cerrar() {
    setNombre("");
    setSlug("");
    setCodigo(null);
    setError(null);
    onCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Precargar un taller"
      pie={
        codigo ? (
          <Boton onClick={cerrar}>Listo</Boton>
        ) : (
          <>
            <Boton variante="secundario" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton onClick={crearlo} cargando={ocupado} disabled={nombre.trim().length < 2}>
              Crear taller
            </Boton>
          </>
        )
      }
    >
      {codigo ? (
        <div className="space-y-3">
          <Aviso tono="exito">Taller creado con 30 días de prueba, horario base y catálogo de servicios.</Aviso>
          <p className="text-sm text-muted">Envíale este código al dueño. Lo usa en /alta → “Tengo un código de acceso”. Es de un solo uso.</p>
          <CodigoGenerado codigo={codigo} />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">Para dar de alta un taller por su dueño (por ejemplo, durante una visita). Se crea sin dueño y se genera un código para reclamarlo.</p>
          <Campo etiqueta="Nombre del taller">
            <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Dirección de su página" ayuda={`Quedará como /${slugAuto || "mi-taller"}`}>
            <Entrada value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugAuto} />
          </Campo>
          {error && <Aviso tono="error">{error}</Aviso>}
        </div>
      )}
    </Modal>
  );
}

function Administradores({ datos, onCambio }: { datos: Datos; onCambio: () => void }) {
  const avisar = useAvisos();
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function agregar() {
    setOcupado(true);
    try {
      await llamar("/api/admin/accion", "POST", { accion: "agregar_admin", email });
      setEmail("");
      avisar("Administrador agregado");
      onCambio();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(a: Admin) {
    if (!confirm(`¿Quitar a ${a.email} como administrador?`)) return;
    try {
      await llamar("/api/admin/accion", "POST", { accion: "quitar_admin", user_id: a.auth_user_id });
      onCambio();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Error", "error");
    }
  }

  return (
    <div className="mt-5 max-w-2xl space-y-4">
      <Tarjeta className="flex flex-wrap items-end gap-2 p-4">
        <Campo etiqueta="Correo de su cuenta (debe estar registrada)" className="min-w-64 flex-1">
          <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Boton variante="oscuro" icono={<Users className="size-4" />} onClick={agregar} cargando={ocupado} disabled={!email.includes("@")}>
          Agregar admin
        </Boton>
      </Tarjeta>
      <Tarjeta className="divide-y divide-line">
        {datos.admins.map((a) => (
          <div key={a.auth_user_id} className="flex items-center gap-3 px-4 py-3">
            <ShieldCheck className="size-5 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {a.nombre} {a.auth_user_id === datos.yo.id && <span className="text-sm font-normal text-muted">(tú)</span>}
              </p>
              <p className="truncate text-sm text-muted">{a.email}</p>
            </div>
            {a.auth_user_id !== datos.yo.id && (
              <button onClick={() => quitar(a)} className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Quitar admin">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </Tarjeta>
    </div>
  );
}
