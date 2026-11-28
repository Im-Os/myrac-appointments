"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarX2 } from "lucide-react";
import { Cargando, cx } from "@/components/ui";
import { diaClave, fechaLarga, hora, hora24, hoyClave, nombreDia, numeroDia, relativoDia, sumarDias } from "@/lib/fechas";
import { supabase } from "@/lib/supabase";
import type { Slot } from "@/lib/tipos";

/** Tira de días + horarios disponibles, calculados por la base de datos. */
export function SelectorHorario({
  slug,
  servicioId,
  tz,
  diasMax,
  valor,
  onElegir,
  excluir,
}: {
  slug: string;
  servicioId: string;
  tz: string;
  diasMax: number;
  valor: string | null;
  onElegir: (inicio: string) => void;
  excluir?: string;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const tira = useRef<HTMLDivElement>(null);
  const hoy = hoyClave(tz);

  useEffect(() => {
    setSlots(null);
    supabase()
      .rpc("horarios_disponibles", { p_slug: slug, p_servicio_id: servicioId, p_desde: hoy, p_hasta: sumarDias(hoy, diasMax) })
      .then(({ data }) => {
        const lista = ((data ?? []) as Slot[]).filter((s) => s.inicio !== excluir);
        setSlots(lista);
        const primero = valor ? diaClave(valor, tz) : lista[0] ? diaClave(lista[0].inicio, tz) : null;
        setDia(primero);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, servicioId, tz, diasMax, hoy]);

  const porDia = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const d = diaClave(s.inicio, tz);
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return m;
  }, [slots, tz]);

  if (slots === null) return <Cargando texto="Buscando horarios con espacio…" />;
  if (slots.length === 0)
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-500">
          <CalendarX2 className="size-6" />
        </div>
        <p className="mt-3 font-semibold">No hay horarios disponibles</p>
        <p className="mt-1 max-w-xs text-sm text-muted">El taller está lleno en los próximos días para este servicio. Comunícate con ellos directamente.</p>
      </div>
    );

  const dias = Array.from({ length: diasMax + 1 }, (_, i) => sumarDias(hoy, i));
  const delDia = dia ? porDia.get(dia) ?? [] : [];
  const manana = delDia.filter((s) => Number(hora24(s.inicio, tz).slice(0, 2)) < 12);
  const tarde = delDia.filter((s) => Number(hora24(s.inicio, tz).slice(0, 2)) >= 12);

  return (
    <div>
      <div ref={tira} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none sm:-mx-5 sm:px-5">
        {dias.map((d) => {
          const n = porDia.get(d)?.length ?? 0;
          const sel = d === dia;
          return (
            <button
              key={d}
              disabled={n === 0}
              onClick={() => setDia(d)}
              className={cx(
                "flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5 ring-1 transition",
                sel ? "bg-brand text-brand-ink ring-brand shadow-md" : n ? "bg-white ring-line hover:ring-zinc-400" : "bg-transparent text-zinc-300 ring-transparent",
              )}
            >
              <span className={cx("text-[11px] font-medium uppercase", sel ? "opacity-90" : n ? "text-muted" : "")}>{relativoDia(d, tz) ?? nombreDia(d)}</span>
              <span className="text-xl font-semibold tabular-nums">{numeroDia(d)}</span>
              <span className={cx("mt-0.5 size-1.5 rounded-full", n ? (sel ? "bg-current" : "bg-emerald-500") : "bg-transparent")} />
            </button>
          );
        })}
      </div>

      {dia && (
        <div className="mt-4">
          <p className="mb-3 text-sm font-medium capitalize text-zinc-700">{fechaLarga(dia)}</p>
          {[
            { t: "Mañana", l: manana },
            { t: "Tarde", l: tarde },
          ]
            .filter((g) => g.l.length)
            .map((g) => (
              <div key={g.t} className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.t}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {g.l.map((s) => (
                    <button
                      key={s.inicio}
                      onClick={() => onElegir(s.inicio)}
                      className={cx(
                        "h-12 rounded-xl text-[15px] font-medium tabular-nums ring-1 transition",
                        valor === s.inicio ? "bg-brand text-brand-ink ring-brand" : "bg-white ring-line hover:ring-zinc-400",
                      )}
                    >
                      {hora(s.inicio, tz)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
