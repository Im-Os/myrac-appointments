import type { Metadata } from "next";
import { Reserva } from "@/components/reserva";

async function tallerPublico(slug: string): Promise<{ nombre: string; descripcion: string | null } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/taller_publico`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
      next: { revalidate: 300 },
    });
    const data = await r.json();
    return Array.isArray(data) && data[0] ? data[0] : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await tallerPublico(slug);
  if (!t) return { title: "Taller no encontrado" };
  return {
    title: { absolute: `Agenda tu cita · ${t.nombre}` },
    description: t.descripcion ?? `Reserva tu cita en ${t.nombre} en línea, en los horarios con espacio disponible.`,
  };
}

export default async function PaginaTaller({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Reserva slug={slug} />;
}
