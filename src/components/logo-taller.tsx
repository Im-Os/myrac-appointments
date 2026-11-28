import { cx } from "@/components/ui";

/** Logo del taller; si no tiene, la inicial sobre su color de marca. */
export function LogoTaller({ nombre, logo, className }: { nombre: string; logo?: string | null; className?: string }) {
  if (logo)
    return (
      <span className={cx("grid shrink-0 place-items-center overflow-hidden bg-white p-1 ring-1 ring-black/5", className)}>
        <img src={logo} alt={`Logo de ${nombre}`} className="size-full object-contain" />
      </span>
    );
  return (
    <span className={cx("grid shrink-0 place-items-center bg-brand font-bold text-brand-ink", className)}>{nombre.slice(0, 1).toUpperCase()}</span>
  );
}
