"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronsUpDown,
  CreditCard,
  ExternalLink,
  LogOut,
  Plus,
  Settings2,
  Users,
  Warehouse,
  Wrench,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { ProveedorPanel, usePanel } from "@/components/panel-contexto";
import { Cargando, Logo, ProveedorAvisos, cx } from "@/components/ui";
import { LogoTaller } from "@/components/logo-taller";
import { estiloMarca } from "@/lib/estados";
import { supabase } from "@/lib/supabase";

const NAV = [
  { href: "/panel", etiqueta: "Agenda", icono: CalendarDays },
  { href: "/panel/bahias", etiqueta: "Bahías", icono: Warehouse },
  { href: "/panel/servicios", etiqueta: "Servicios", icono: Wrench, soloDueno: true },
  { href: "/panel/equipo", etiqueta: "Equipo", icono: Users },
  { href: "/panel/configuracion", etiqueta: "Configuración", icono: Settings2, soloDueno: true },
  { href: "/panel/suscripcion", etiqueta: "Suscripción", icono: CreditCard, soloDueno: true },
];

export default function LayoutPanel({ children }: { children: ReactNode }) {
  return (
    <ProveedorAvisos>
      <ProveedorPanel cargando={<Cargando className="min-h-dvh" />}>
        <Marco>{children}</Marco>
      </ProveedorPanel>
    </ProveedorAvisos>
  );
}

function Marco({ children }: { children: ReactNode }) {
  const { taller } = usePanel();
  const [menu, setMenu] = useState(false);
  return (
    <div style={estiloMarca(taller.color_marca)} className="min-h-dvh lg:pl-64">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-zinc-950 text-zinc-300 lg:flex">
        <Lateral />
      </aside>

      {/* Menú deslizable (móvil) */}
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenu(false)} />
          <aside className="aparecer absolute inset-y-0 left-0 flex w-72 flex-col bg-zinc-950 text-zinc-300">
            <button onClick={() => setMenu(false)} className="absolute right-3 top-4 grid size-9 place-items-center rounded-full text-zinc-400 hover:bg-white/10" aria-label="Cerrar menú">
              <X className="size-5" />
            </button>
            <Lateral alNavegar={() => setMenu(false)} />
          </aside>
        </div>
      )}

      {/* Encabezado móvil */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setMenu(true)} className="grid size-9 place-items-center rounded-xl text-zinc-700 hover:bg-zinc-100" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
        <span className="flex min-w-0 items-center gap-2 truncate font-semibold">
          <LogoTaller nombre={taller.nombre} logo={taller.logo_url} className="size-7 rounded-lg text-xs" />
          <span className="truncate">{taller.nombre}</span>
        </span>
        <Link href="/panel/citas/nueva" className="grid size-9 place-items-center rounded-xl bg-brand text-brand-ink" aria-label="Nueva cita">
          <Plus className="size-5" />
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>

      {/* Barra inferior (móvil) */}
      <BarraInferior />
    </div>
  );
}

function Lateral({ alNavegar }: { alNavegar?: () => void }) {
  const { taller, talleres, cambiarTaller, esDueno, usuario } = usePanel();
  const ruta = usePathname();
  const [selector, setSelector] = useState(false);
  const nombre = (usuario.user_metadata?.nombre as string) || usuario.email;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Logo claro className="text-white" />
      </div>

      <div className="relative px-3">
        <button
          onClick={() => talleres.length > 1 && setSelector((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left ring-1 ring-white/10 hover:bg-white/10"
        >
          <LogoTaller nombre={taller.nombre} logo={taller.logo_url} className="size-9 rounded-lg text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{taller.nombre}</span>
            <span className="block truncate text-xs text-zinc-400">/{taller.slug}</span>
          </span>
          {talleres.length > 1 && <ChevronsUpDown className="size-4 text-zinc-500" />}
        </button>
        {selector && (
          <div className="aparecer absolute inset-x-3 top-full z-10 mt-1 rounded-xl bg-zinc-900 p-1 shadow-xl ring-1 ring-white/10">
            {talleres.map((t) => (
              <button
                key={t.taller_id}
                onClick={() => {
                  cambiarTaller(t.taller_id);
                  setSelector(false);
                  alNavegar?.();
                }}
                className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10", t.taller_id === taller.id && "text-white")}
              >
                {t.logo_url ? (
                  <img src={t.logo_url} alt="" className="size-5 rounded bg-white object-contain p-0.5" />
                ) : (
                  <span className="size-2 rounded-full" style={{ background: t.color_marca }} />
                )}
                {t.nombre}
              </button>
            ))}
            <Link href="/alta" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/10">
              <Plus className="size-4" /> Agregar taller
            </Link>
          </div>
        )}
      </div>

      <div className="px-3 pt-4">
        <Link
          href="/panel/citas/nueva"
          onClick={alNavegar}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-brand-ink hover:brightness-110"
        >
          <Plus className="size-4" /> Nueva cita
        </Link>
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 px-3">
        {NAV.filter((n) => !n.soloDueno || esDueno).map(({ href, etiqueta, icono: Icono }) => {
          const activo = href === "/panel" ? ruta === "/panel" || ruta.startsWith("/panel/citas") : ruta.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={alNavegar}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition",
                activo ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
              )}
            >
              <Icono className={cx("size-[18px]", activo && "text-brand")} />
              {etiqueta}
            </Link>
          );
        })}
        <a
          href={`/${taller.slug}`}
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
        >
          <ExternalLink className="size-[18px]" />
          Mi página de citas
        </a>
        <EnlaceAdmin />
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {String(nombre).slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{nombre}</span>
          <button
            onClick={() => supabase().auth.signOut()}
            className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BarraInferior() {
  const ruta = usePathname();
  const { esDueno } = usePanel();
  const items = [
    { href: "/panel", etiqueta: "Agenda", icono: CalendarDays },
    { href: "/panel/bahias", etiqueta: "Bahías", icono: Warehouse },
    esDueno
      ? { href: "/panel/configuracion", etiqueta: "Ajustes", icono: Settings2 }
      : { href: "/panel/equipo", etiqueta: "Equipo", icono: Users },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ href, etiqueta, icono: Icono }) => {
          const activo = href === "/panel" ? ruta === "/panel" || ruta.startsWith("/panel/citas") : ruta.startsWith(href);
          return (
            <Link key={href} href={href} className={cx("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", activo ? "text-zinc-950" : "text-zinc-400")}>
              <Icono className={cx("size-5", activo && "text-brand")} />
              {etiqueta}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Solo aparece si la cuenta es administradora de la plataforma. */
function EnlaceAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    supabase()
      .rpc("soy_admin_plataforma")
      .then(({ data }) => setAdmin(data === true));
  }, []);
  if (!admin) return null;
  return (
    <Link href="/admin" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-zinc-400 ring-1 ring-white/10 hover:bg-white/5 hover:text-zinc-100">
      <ShieldCheck className="size-[18px] text-[#E11D2E]" />
      Admin plataforma
    </Link>
  );
}
