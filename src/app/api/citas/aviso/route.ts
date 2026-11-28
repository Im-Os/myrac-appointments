import { supabaseAdmin } from "@/lib/servidor/supabase-admin";
import { enviarCorreo, plantillaCita } from "@/lib/servidor/correo";
import { diaClave, fechaLarga, hora, mayus } from "@/lib/fechas";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  inicio: string;
  estado: "pendiente" | "confirmada" | "recibida" | "cancelada" | "no_asistio";
  token_cliente: string;
  aviso_estado: string | null;
  aviso_inicio: string | null;
  cliente: { nombre: string; email: string | null } | null;
  vehiculo: { marca: string; modelo: string; anio: number | null } | null;
  servicio: { nombre: string } | null;
  taller: { nombre: string; color_marca: string; logo_url: string | null; zona_horaria: string; direccion: string | null } | null;
};

const TEXTOS = {
  pendiente: { asunto: "Recibimos tu solicitud de cita", titulo: "Tu lugar está apartado", texto: "El taller revisará tu solicitud y te confirmará en breve." },
  confirmada: { asunto: "Tu cita está confirmada", titulo: "¡Cita confirmada!", texto: "Te esperamos. Llega unos minutos antes." },
  cancelada: { asunto: "Tu cita fue cancelada", titulo: "Cita cancelada", texto: "Esta cita ya no está vigente. Puedes agendar otra cuando quieras." },
} as const;

/**
 * Envía al cliente el correo que corresponde al estado actual de su cita (solicitada, confirmada,
 * cancelada o con nuevo horario). Se identifica con el token de la cita y nunca repite el mismo aviso.
 */
export async function POST(req: Request) {
  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return Response.json({ enviado: false });

    const db = supabaseAdmin();
    const { data } = await db
      .from("citas")
      .select(
        "id,inicio,estado,token_cliente,aviso_estado,aviso_inicio,cliente:clientes(nombre,email),vehiculo:vehiculos(marca,modelo,anio),servicio:servicios(nombre),taller:talleres(nombre,color_marca,logo_url,zona_horaria,direccion)",
      )
      .eq("token_cliente", token)
      .maybeSingle();
    const c = data as unknown as Fila | null;
    if (!c || !c.cliente?.email || !c.taller) return Response.json({ enviado: false });
    if (c.estado !== "pendiente" && c.estado !== "confirmada" && c.estado !== "cancelada") return Response.json({ enviado: false });
    if (c.aviso_estado === c.estado && c.aviso_inicio && new Date(c.aviso_inicio).getTime() === new Date(c.inicio).getTime())
      return Response.json({ enviado: false, motivo: "ya_avisado" });

    const tz = c.taller.zona_horaria;
    const cambioHorario = !!c.aviso_inicio && c.aviso_estado !== "cancelada" && c.estado !== "cancelada" && new Date(c.aviso_inicio).getTime() !== new Date(c.inicio).getTime();
    const t = TEXTOS[c.estado];
    const origen = new URL(req.url).origin;
    const html = plantillaCita({
      color: c.taller.color_marca,
      taller: c.taller.nombre,
      titulo: cambioHorario ? "Cambiamos el horario de tu cita" : t.titulo,
      texto: t.texto,
      fecha: mayus(fechaLarga(diaClave(c.inicio, tz))),
      hora: hora(c.inicio, tz),
      servicio: c.servicio?.nombre ?? "",
      vehiculo: [c.vehiculo?.marca, c.vehiculo?.modelo, c.vehiculo?.anio].filter(Boolean).join(" "),
      enlace: `${origen}/cita/${c.token_cliente}`,
      direccion: c.taller.direccion,
      logo: c.taller.logo_url,
    });
    const asunto = `${cambioHorario ? "Nuevo horario de tu cita" : t.asunto} · ${c.taller.nombre}`;
    const ok = await enviarCorreo(c.cliente.email, asunto, html);
    if (ok) await db.from("citas").update({ aviso_estado: c.estado, aviso_inicio: c.inicio }).eq("id", c.id);
    return Response.json({ enviado: ok });
  } catch (e) {
    console.error("[aviso]", e);
    return Response.json({ enviado: false }, { status: 500 });
  }
}
