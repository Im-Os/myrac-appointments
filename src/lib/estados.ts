import type { EstadoCita, EstadoEstancia, Rol } from "./tipos";
import type { CSSProperties } from "react";

type Estilo = { etiqueta: string; clase: string; punto: string };

export const ESTADO_CITA: Record<EstadoCita, Estilo> = {
  pendiente: { etiqueta: "Por confirmar", clase: "bg-amber-50 text-amber-800 ring-amber-200", punto: "bg-amber-500" },
  confirmada: { etiqueta: "Confirmada", clase: "bg-sky-50 text-sky-800 ring-sky-200", punto: "bg-sky-500" },
  recibida: { etiqueta: "Recibida", clase: "bg-emerald-50 text-emerald-800 ring-emerald-200", punto: "bg-emerald-500" },
  cancelada: { etiqueta: "Cancelada", clase: "bg-zinc-100 text-zinc-600 ring-zinc-200", punto: "bg-zinc-400" },
  no_asistio: { etiqueta: "No asistió", clase: "bg-rose-50 text-rose-700 ring-rose-200", punto: "bg-rose-500" },
};

export const ESTADO_ESTANCIA: Record<EstadoEstancia, Estilo> = {
  diagnostico: { etiqueta: "Diagnóstico", clase: "bg-violet-50 text-violet-800 ring-violet-200", punto: "bg-violet-500" },
  esperando_refacciones: {
    etiqueta: "Esperando refacciones",
    clase: "bg-amber-50 text-amber-800 ring-amber-200",
    punto: "bg-amber-500",
  },
  en_reparacion: { etiqueta: "En reparación", clase: "bg-sky-50 text-sky-800 ring-sky-200", punto: "bg-sky-500" },
  listo: { etiqueta: "Listo para entregar", clase: "bg-emerald-50 text-emerald-800 ring-emerald-200", punto: "bg-emerald-500" },
  entregado: { etiqueta: "Entregado", clase: "bg-zinc-100 text-zinc-600 ring-zinc-200", punto: "bg-zinc-400" },
};

export const ROLES: Record<Rol, { etiqueta: string; descripcion: string }> = {
  dueno: { etiqueta: "Dueño", descripcion: "Todo, incluida la configuración y el equipo" },
  recepcion: { etiqueta: "Recepción", descripcion: "Agenda, citas y bahías" },
  mecanico: { etiqueta: "Mecánico", descripcion: "Agenda, citas y bahías" },
};

export const TIPO_SERVICIO = {
  deja_auto: { etiqueta: "Deja el auto", descripcion: "Ocupa una bahía hasta que se entrega" },
  espera: { etiqueta: "Mientras espera", descripcion: "Solo ocupa un lugar de recepción" },
} as const;

export const COLORES_MARCA = [
  { nombre: "Rojo", valor: "#E11D2E" },
  { nombre: "Naranja", valor: "#EA580C" },
  { nombre: "Ámbar", valor: "#D97706" },
  { nombre: "Verde", valor: "#16A34A" },
  { nombre: "Turquesa", valor: "#0D9488" },
  { nombre: "Azul", valor: "#2563EB" },
  { nombre: "Índigo", valor: "#4F46E5" },
  { nombre: "Violeta", valor: "#7C3AED" },
  { nombre: "Grafito", valor: "#27272A" },
];

/** Texto legible (blanco o negro) sobre el color de marca. */
export function tintaSobre(hex: string): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#18181b" : "#ffffff";
}

export function estiloMarca(hex: string): CSSProperties {
  return { "--brand": hex, "--brand-ink": tintaSobre(hex) } as CSSProperties;
}
