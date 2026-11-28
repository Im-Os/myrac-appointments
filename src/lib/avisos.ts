"use client";

import { diaClave, enlaceWhatsApp, fechaLarga, hora } from "@/lib/fechas";

/** Pide al servidor que mande el correo que corresponda al estado actual de la cita (si el cliente dejó correo). */
export function avisarCliente(token: string | null | undefined) {
  if (!token) return;
  fetch("/api/citas/aviso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    keepalive: true,
  }).catch(() => {});
}

/** Enlace de WhatsApp con la confirmación ya escrita, listo para que el taller solo toque "Enviar". */
export function whatsappConfirmacion(o: {
  telefono: string;
  cliente?: string | null;
  taller: string;
  inicio: string;
  tz: string;
  servicio?: string | null;
  token: string;
}) {
  const nombre = (o.cliente ?? "").split(" ")[0];
  const texto =
    `Hola ${nombre}, tu cita en ${o.taller} quedó *confirmada* ✅\n\n` +
    `📅 ${fechaLarga(diaClave(o.inicio, o.tz))}\n` +
    `🕘 Llegada: ${hora(o.inicio, o.tz)}\n` +
    (o.servicio ? `🔧 ${o.servicio}\n` : "") +
    `\nAquí puedes ver, cambiar o cancelar tu cita:\n${window.location.origin}/cita/${o.token}`;
  return enlaceWhatsApp(o.telefono, texto);
}
