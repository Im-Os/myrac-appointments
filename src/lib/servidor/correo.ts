import "server-only";

/** Envía un correo con Resend. Si no hay llave configurada, no hace nada (la app sigue funcionando). */
export async function enviarCorreo(para: string, asunto: string, html: string): Promise<boolean> {
  const llave = process.env.RESEND_API_KEY;
  const de = process.env.AVISOS_REMITENTE; // p. ej. "MYRAC Citas <citas@tudominio.com>"
  if (!llave || !de) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [para], subject: asunto, html }),
  });
  if (!r.ok) console.error("[correo]", r.status, await r.text().catch(() => ""));
  return r.ok;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function plantillaCita(o: {
  color: string;
  taller: string;
  titulo: string;
  texto: string;
  fecha: string;
  hora: string;
  servicio: string;
  vehiculo: string;
  enlace: string;
  direccion?: string | null;
}) {
  const fila = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#71717a;font-size:14px;width:110px">${k}</td><td style="padding:6px 0;font-size:15px;color:#18181b">${esc(v)}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f6f6f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7">
<tr><td style="background:#18181b;padding:20px 24px;color:#fff;font-size:18px;font-weight:bold"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${o.color};margin-right:8px"></span>${esc(o.taller)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 6px;font-size:20px;font-weight:bold;color:#18181b">${esc(o.titulo)}</p>
<p style="margin:0 0 18px;font-size:15px;color:#3f3f46">${esc(o.texto)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${fila("Fecha", o.fecha)}${fila("Llegada", o.hora)}${fila("Servicio", o.servicio)}${fila("Vehículo", o.vehiculo)}${o.direccion ? fila("Dirección", o.direccion) : ""}
</table>
<p style="margin:22px 0 0"><a href="${o.enlace}" style="display:inline-block;background:${o.color};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Ver, cambiar o cancelar mi cita</a></p>
</td></tr></table>
<p style="font-size:12px;color:#a1a1aa;margin-top:14px">Citas con MYRAC Appointments</p>
</td></tr></table></body></html>`;
}
