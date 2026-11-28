"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Cliente único de Supabase para el navegador. La seguridad la garantiza RLS en la base de datos. */
export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    client = createBrowserClient(url, key);
  }
  return client;
}

const MENSAJES: Record<string, string> = {
  TALLER_NO_ENCONTRADO: "No encontramos este taller.",
  TELEFONO_INVALIDO: "El teléfono debe tener 10 dígitos.",
  DATOS_INCOMPLETOS: "Faltan datos obligatorios.",
  HORARIO_NO_DISPONIBLE: "Ese horario acaba de ocuparse. Elige otro, por favor.",
  CITA_NO_CANCELABLE: "Esta cita ya no se puede cancelar.",
  CITA_NO_REPROGRAMABLE: "Esta cita ya no se puede reprogramar.",
  CITA_NO_RECIBIBLE: "Esta cita ya no se puede recibir.",
  CITA_NO_CONFIRMABLE: "Esta cita ya no está pendiente.",
  BAHIA_INVALIDA: "Esa bahía no existe.",
  SIN_PERMISO: "No tienes permiso para hacer esto.",
  SIN_SESION: "Tu sesión terminó. Vuelve a entrar.",
  SLUG_OCUPADO: "Esa dirección ya está en uso. Prueba otra.",
  CODIGO_INVALIDO: "El código no es válido o ya se usó.",
  USUARIO_NO_REGISTRADO: "Esa persona aún no tiene cuenta. Pídele que se registre primero.",
  ULTIMO_DUENO: "El taller necesita al menos un dueño.",
  SERVICIO_INVALIDO: "Ese servicio no pertenece al taller.",
  estancias_bahia_unica: "Esa bahía ya está ocupada.",
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "User already registered": "Ya existe una cuenta con ese correo.",
  "Email not confirmed": "Confirma tu correo antes de entrar.",
};

/** Convierte un error de Supabase/Postgres en un mensaje claro para el usuario. */
export function mensajeError(e: unknown): string {
  const texto =
    typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : String(e);
  for (const [clave, msg] of Object.entries(MENSAJES)) if (texto.includes(clave)) return msg;
  if (texto.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres.";
  if (texto.includes("rate limit")) return "Demasiados intentos. Espera un momento.";
  if (texto.includes("Failed to fetch")) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  return "Algo salió mal. Inténtalo de nuevo.";
}
