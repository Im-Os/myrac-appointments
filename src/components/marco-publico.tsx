import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { estiloMarca } from "@/lib/estados";
import { enlaceWhatsApp, telefonoBonito } from "@/lib/fechas";
import type { TallerPublico } from "@/lib/tipos";

/** Encabezado con la identidad del taller y pie "con tecnología de". */
export function MarcoPublico({ taller, children }: { taller: TallerPublico; children: ReactNode }) {
  return (
    <div style={estiloMarca(taller.color_marca)} className="min-h-dvh bg-bg">
      <header className="relative overflow-hidden bg-zinc-950 text-white">
        <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(80% 120% at 100% 0%, ${taller.color_marca}, transparent 60%)` }} />
        <div className="relative mx-auto max-w-2xl px-5 pb-8 pt-8">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-xl font-bold text-brand-ink shadow-lg">
              {taller.nombre.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{taller.nombre}</h1>
              <p className="text-sm text-white/70">Agenda tu cita en línea</p>
            </div>
          </div>
          {taller.descripcion && <p className="mt-4 max-w-xl text-[15px] text-white/80">{taller.descripcion}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {taller.direccion && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${taller.nombre} ${taller.direccion}`)}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/15"
              >
                <MapPin className="size-3.5" /> {taller.direccion}
              </a>
            )}
            {taller.telefono && (
              <>
                <a href={`tel:${taller.telefono}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/15">
                  <Phone className="size-3.5" /> {telefonoBonito(taller.telefono)}
                </a>
                <a
                  href={enlaceWhatsApp(taller.telefono)}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 hover:bg-white/15"
                >
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-5 sm:px-5">{children}</main>
      <footer className="pb-8 text-center text-xs text-zinc-400">
        Citas con{" "}
        <Link href="/" className="font-medium text-zinc-500 hover:text-zinc-800">
          MYRAC Appointments
        </Link>
      </footer>
    </div>
  );
}
