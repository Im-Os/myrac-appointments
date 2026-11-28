"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { CheckCircle2, Loader2, X, AlertTriangle } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* Botones ------------------------------------------------------------------ */
type Variante = "primario" | "secundario" | "fantasma" | "peligro" | "oscuro";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-brand text-brand-ink shadow-sm hover:brightness-110 active:brightness-95",
  oscuro: "bg-zinc-900 text-white shadow-sm hover:bg-zinc-800",
  secundario: "bg-white text-zinc-900 ring-1 ring-inset ring-line hover:bg-zinc-50 shadow-xs",
  fantasma: "text-zinc-700 hover:bg-zinc-100",
  peligro: "bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
};

export function Boton({
  variante = "primario",
  tam = "md",
  cargando,
  icono,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  tam?: "sm" | "md" | "lg";
  cargando?: boolean;
  icono?: ReactNode;
}) {
  const tamanos = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-[15px] gap-2" };
  return (
    <button
      {...props}
      disabled={disabled || cargando}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        tamanos[tam],
        VARIANTES[variante],
        className,
      )}
    >
      {cargando ? <Loader2 className="size-4 animate-spin" /> : icono}
      {children}
    </button>
  );
}

/* Formularios -------------------------------------------------------------- */
const campoBase =
  "rounded-xl border-0 bg-white px-3.5 text-[15px] text-zinc-900 ring-1 ring-inset ring-line placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand outline-none transition disabled:bg-zinc-50 disabled:text-zinc-500";

export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
  className,
}: {
  etiqueta?: ReactNode;
  ayuda?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      {etiqueta && <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">{etiqueta}</span>}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] text-rose-600">{error}</span>
      ) : (
        ayuda && <span className="mt-1.5 block text-[13px] text-muted">{ayuda}</span>
      )}
    </label>
  );
}

const ancho = (c?: string) => (/(^|\s)(max-)?w-/.test(c ?? "") ? (/(^|\s)w-/.test(c ?? "") ? "" : "w-full") : "w-full");

export function Entrada({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(campoBase, ancho(className), "h-11", className)} />;
}

export function Area({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(campoBase, ancho(className), "min-h-20 py-2.5", className)} />;
}

export function Selector({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        campoBase,
        ancho(className),
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2371717a%22><path d=%22M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z%22/></svg>')] bg-[length:18px] bg-[right_10px_center] bg-no-repeat pr-9",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  disabled,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  etiqueta?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50",
        activo ? "bg-brand" : "bg-zinc-300",
      )}
    >
      <span
        className={cx(
          "inline-block size-5 rounded-full bg-white shadow transition",
          activo ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Numero({
  valor,
  onCambio,
  min = 1,
  max = 999,
  sufijo,
}: {
  valor: number;
  onCambio: (n: number) => void;
  min?: number;
  max?: number;
  sufijo?: string;
}) {
  const fijar = (n: number) => onCambio(Math.max(min, Math.min(max, n)));
  return (
    <div className="inline-flex h-11 items-center rounded-xl bg-white ring-1 ring-inset ring-line">
      <button type="button" onClick={() => fijar(valor - 1)} className="h-full w-11 text-lg text-zinc-600 hover:text-zinc-900" aria-label="Menos">
        −
      </button>
      <input
        inputMode="numeric"
        value={valor}
        onChange={(e) => fijar(Number(e.target.value.replace(/\D/g, "")) || min)}
        className="w-12 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none"
      />
      {sufijo && <span className="pr-1 text-[13px] text-muted">{sufijo}</span>}
      <button type="button" onClick={() => fijar(valor + 1)} className="h-full w-11 text-lg text-zinc-600 hover:text-zinc-900" aria-label="Más">
        +
      </button>
    </div>
  );
}

/* Superficies -------------------------------------------------------------- */
export function Tarjeta({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx("rounded-2xl bg-surface ring-1 ring-line shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {children}
    </div>
  );
}

export function Insignia({ className, children, punto }: { className?: string; children: ReactNode; punto?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", className)}>
      {punto && <span className={cx("size-1.5 rounded-full", punto)} />}
      {children}
    </span>
  );
}

export function Cargando({ texto = "Cargando…", className }: { texto?: string; className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-2 py-16 text-sm text-muted", className)}>
      <Loader2 className="size-4 animate-spin" /> {texto}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, accion }: { icono?: ReactNode; titulo: string; texto?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icono && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-500">{icono}</div>}
      <p className="font-semibold text-zinc-900">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-muted">{texto}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Aviso({ tono = "info", children, className }: { tono?: "info" | "error" | "exito" | "alerta"; children: ReactNode; className?: string }) {
  const tonos = {
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    exito: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    alerta: "bg-amber-50 text-amber-900 ring-amber-200",
  };
  return <div className={cx("rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset", tonos[tono], className)}>{children}</div>;
}

/* Modal --------------------------------------------------------------------- */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  pie,
  ancho = "max-w-lg",
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={onCerrar} />
      <div className={cx("aparecer relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl", ancho)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-[17px] font-semibold">{titulo}</h2>
          <button onClick={onCerrar} className="grid size-8 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Cerrar">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{pie}</div>}
      </div>
    </div>
  );
}

/* Notificaciones -------------------------------------------------------------- */
type Toast = { id: number; texto: string; tono: "exito" | "error" };
const ToastCtx = createContext<(texto: string, tono?: "exito" | "error") => void>(() => {});

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);
  const avisar = useCallback((texto: string, tono: "exito" | "error" = "exito") => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, texto, tono }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {lista.map((t) => (
          <div
            key={t.id}
            className="aparecer pointer-events-auto flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl"
          >
            {t.tono === "exito" ? (
              <CheckCircle2 className="size-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="size-4 text-rose-400" />
            )}
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx>
  );
}

export function useAvisos() {
  return useContext(ToastCtx);
}

/* Encabezado de página --------------------------------------------------------- */
export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[28px]">{titulo}</h1>
        {descripcion && <p className="mt-1 text-[15px] text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function Logo({ className, claro }: { className?: string; claro?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
        <rect width="64" height="64" rx="14" fill={claro ? "#ffffff" : "#18181b"} />
        <rect x="14" y="17" width="36" height="32" rx="6" fill="none" stroke={claro ? "#18181b" : "#fff"} strokeWidth="4" />
        <path d="M14 27h36" stroke={claro ? "#18181b" : "#fff"} strokeWidth="4" />
        <path d="M23 12v9M41 12v9" stroke={claro ? "#18181b" : "#fff"} strokeWidth="4" strokeLinecap="round" />
        <circle cx="32" cy="38" r="5" fill="#e11d2e" />
      </svg>
      <span className="text-[15px]">
        MYRAC <span className="font-normal opacity-60">Appointments</span>
      </span>
    </span>
  );
}
