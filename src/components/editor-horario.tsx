"use client";

import { DIAS_SEMANA } from "@/lib/fechas";
import type { Horario } from "@/lib/tipos";
import { Interruptor, cx } from "@/components/ui";

export type DiaHorario = { abierto: boolean; abre: string; cierra: string };

export function horarioAEditor(h: Horario[]): DiaHorario[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = h.find((x) => x.dia_semana === i + 1);
    return d ? { abierto: true, abre: d.abre.slice(0, 5), cierra: d.cierra.slice(0, 5) } : { abierto: false, abre: "09:00", cierra: "18:00" };
  });
}

export function editorAHorario(dias: DiaHorario[]): Horario[] {
  return dias.flatMap((d, i) => (d.abierto ? [{ dia_semana: i + 1, abre: d.abre, cierra: d.cierra }] : []));
}

export function horarioValido(dias: DiaHorario[]): string | null {
  if (!dias.some((d) => d.abierto)) return "Abre al menos un día.";
  for (const [i, d] of dias.entries()) if (d.abierto && d.cierra <= d.abre) return `${DIAS_SEMANA[i]}: la hora de cierre debe ser después de la de apertura.`;
  return null;
}

export function EditorHorario({ dias, onCambio }: { dias: DiaHorario[]; onCambio: (d: DiaHorario[]) => void }) {
  const fijar = (i: number, cambio: Partial<DiaHorario>) => onCambio(dias.map((d, j) => (j === i ? { ...d, ...cambio } : d)));
  const hora = "h-10 rounded-lg bg-white px-2 text-[15px] tabular-nums ring-1 ring-inset ring-line outline-none focus:ring-2 focus:ring-brand disabled:opacity-40";
  return (
    <div className="divide-y divide-line rounded-2xl ring-1 ring-line">
      {dias.map((d, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Interruptor activo={d.abierto} onCambio={(v) => fijar(i, { abierto: v })} etiqueta={`Abrir ${DIAS_SEMANA[i]}`} />
          <span className={cx("w-24 text-[15px] font-medium", !d.abierto && "text-zinc-400")}>{DIAS_SEMANA[i]}</span>
          {d.abierto ? (
            <div className="ml-auto flex items-center gap-2 text-sm text-muted">
              <input type="time" step={900} value={d.abre} onChange={(e) => fijar(i, { abre: e.target.value })} className={hora} />
              a
              <input type="time" step={900} value={d.cierra} onChange={(e) => fijar(i, { cierra: e.target.value })} className={hora} />
            </div>
          ) : (
            <span className="ml-auto text-sm text-zinc-400">Cerrado</span>
          )}
        </div>
      ))}
    </div>
  );
}
