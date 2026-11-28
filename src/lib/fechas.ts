// Fechas siempre en la zona horaria del taller, no en la del dispositivo.

const LOCALE = "es-MX";

function partes(fecha: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), min: g("minute"), s: g("second") };
}

/** "YYYY-MM-DD" del instante en la zona del taller. */
export function diaClave(iso: string | Date, tz: string): string {
  const { y, m, d } = partes(new Date(iso), tz);
  return `${y}-${m}-${d}`;
}

export function hoyClave(tz: string): string {
  return diaClave(new Date(), tz);
}

/** Suma días a una clave "YYYY-MM-DD". */
export function sumarDias(clave: string, n: number): string {
  const [y, m, d] = clave.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}

/** Día ISO de la semana (1 = lunes … 7 = domingo) de una clave. */
export function diaSemana(clave: string): number {
  const [y, m, d] = clave.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Lunes de la semana de una clave. */
export function inicioSemana(clave: string): string {
  return sumarDias(clave, 1 - diaSemana(clave));
}

/** Convierte fecha + hora local del taller a un instante ISO (UTC). */
export function aInstante(clave: string, hora: string, tz: string): string {
  const [y, m, d] = clave.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const supuesto = Date.UTC(y, m - 1, d, h, min);
  // Diferencia entre lo que "se ve" en la zona y lo que se quería; se corrige dos veces por cambios de horario.
  let t = supuesto;
  for (let i = 0; i < 2; i++) {
    const p = partes(new Date(t), tz);
    const visto = Date.UTC(+p.y, +p.m - 1, +p.d, +p.h, +p.min);
    t += supuesto - visto;
  }
  return new Date(t).toISOString();
}

export function hora(iso: string, tz: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/\s?a\.?\s?m\.?/i, " a. m.")
    .replace(/\s?p\.?\s?m\.?/i, " p. m.");
}

export function hora24(iso: string, tz: string): string {
  const p = partes(new Date(iso), tz);
  return `${p.h}:${p.min}`;
}

function desdeClave(clave: string) {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "jueves 27 de noviembre" */
export function fechaLarga(clave: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    desdeClave(clave),
  );
}

/** "jue 27 nov" */
export function fechaCorta(clave: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(desdeClave(clave))
    .replace(/\./g, "");
}

export function nombreDia(clave: string, formato: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: formato }).format(desdeClave(clave)).replace(".", "");
}

export function numeroDia(clave: string): number {
  return Number(clave.slice(8, 10));
}

export function mesAnio(clave: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "long", year: "numeric" }).format(desdeClave(clave));
}

export function relativoDia(clave: string, tz: string): string | null {
  const hoy = hoyClave(tz);
  if (clave === hoy) return "Hoy";
  if (clave === sumarDias(hoy, 1)) return "Mañana";
  if (clave === sumarDias(hoy, -1)) return "Ayer";
  return null;
}

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function telefonoBonito(t: string | null | undefined): string {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length !== 10) return t ?? "";
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function enlaceWhatsApp(telefono: string, texto?: string): string {
  const d = telefono.replace(/\D/g, "");
  const numero = d.length === 10 ? `52${d}` : d;
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}
