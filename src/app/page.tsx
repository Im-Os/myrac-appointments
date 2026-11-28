import Link from "next/link";
import { CalendarCheck2, Car, Gauge, Link2, ShieldCheck, Smartphone, Warehouse } from "lucide-react";
import { Logo } from "@/components/ui";

const PUNTOS = [
  {
    icono: CalendarCheck2,
    titulo: "Solo horarios con espacio real",
    texto: "Tus clientes ven los horarios en los que de verdad puedes recibirlos: respeta tus cupos de recepción y tus bahías.",
  },
  {
    icono: Warehouse,
    titulo: "Bahías bajo control",
    texto: "Un auto ocupa su bahía hasta que se entrega, aunque espere refacciones. Sin sobrecupo ni sorpresas.",
  },
  {
    icono: Link2,
    titulo: "Tu página de citas",
    texto: "Un enlace y un código QR con los colores de tu taller para compartir en WhatsApp, Google y redes.",
  },
  {
    icono: ShieldCheck,
    titulo: "Tú decides cómo confirmar",
    texto: "Confirma cada cita a mano o deja que se confirmen solas. Se cambia en un clic.",
  },
  {
    icono: Smartphone,
    titulo: "Desde el celular o la compu",
    texto: "Agenda del día, recepción de autos y tablero de bahías en cualquier dispositivo. Instálala como app.",
  },
  {
    icono: Gauge,
    titulo: "Para cualquier taller",
    texto: "Mecánica general, frenos, eléctrico, llantas o agencia: ajusta servicios, horarios y capacidad a tu medida.",
  },
];

export default function Inicio() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/entrar" className="rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            Entrar
          </Link>
          <Link href="/registro" className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_50%_0%,rgba(225,29,46,0.10),transparent)]"
          />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-12 text-center sm:pt-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              <Car className="size-3.5" /> Agenda en línea para talleres automotrices
            </span>
            <h1 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Citas que respetan la capacidad real de tu taller
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-zinc-600">
              Tus clientes reservan en segundos. Tú controlas recepciones, bahías y confirmaciones desde un solo lugar.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/registro"
                className="rounded-2xl bg-[#E11D2E] px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-red-600/20 hover:brightness-110"
              >
                Probar 30 días gratis
              </Link>
              <Link
                href="/myrac"
                className="rounded-2xl bg-white px-6 py-3.5 text-[15px] font-semibold text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50"
              >
                Ver una página de citas
              </Link>
            </div>

            <div className="mx-auto mt-14 max-w-4xl rounded-3xl bg-zinc-950 p-2 shadow-2xl shadow-zinc-900/20 ring-1 ring-zinc-800">
              <div className="grid gap-2 rounded-[20px] bg-zinc-900 p-4 text-left sm:grid-cols-3">
                {[
                  { h: "09:00", n: "Golf GTI 2012", s: "Diagnóstico con escáner", e: "Recibida", c: "bg-emerald-400" },
                  { h: "09:30", n: "Jetta 2019", s: "Cambio de balatas", e: "Confirmada", c: "bg-sky-400" },
                  { h: "10:00", n: "Versa 2021", s: "Afinación", e: "Por confirmar", c: "bg-amber-400" },
                ].map((c) => (
                  <div key={c.h} className="rounded-2xl bg-zinc-800/70 p-4 ring-1 ring-white/5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-mono">{c.h}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${c.c}`} />
                        {c.e}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-white">{c.n}</p>
                    <p className="text-sm text-zinc-400">{c.s}</p>
                  </div>
                ))}
                <div className="rounded-2xl bg-zinc-800/70 p-4 ring-1 ring-white/5 sm:col-span-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Bahías</span>
                    <span>5 de 7 ocupadas</span>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1.5">
                    {[1, 1, 1, 1, 1, 0, 0].map((o, i) => (
                      <div key={i} className={`h-8 rounded-lg ${o ? "bg-[#E11D2E]" : "bg-zinc-700"}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-100 bg-zinc-50/60">
          <div className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {PUNTOS.map(({ icono: Icono, titulo, texto }) => (
              <div key={titulo} className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200/70">
                <div className="grid size-10 place-items-center rounded-xl bg-zinc-900 text-white">
                  <Icono className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">{titulo}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-600">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-zinc-950 p-8 text-white sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Configura tu taller en 3 minutos</h2>
              <p className="mt-2 text-zinc-400">Bahías, horario y servicios precargados. Ajústalos cuando quieras.</p>
            </div>
            <Link href="/registro" className="rounded-2xl bg-white px-6 py-3.5 text-[15px] font-semibold text-zinc-900 hover:bg-zinc-100">
              Empezar ahora
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-zinc-500">
          <span>© {new Date().getFullYear()} MYRAC OS</span>
          <span>Hecho en Morelia, Michoacán</span>
        </div>
      </footer>
    </div>
  );
}
