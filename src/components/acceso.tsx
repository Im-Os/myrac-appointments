"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Aviso, Boton, Campo, Entrada, Logo } from "@/components/ui";
import { mensajeError, supabase } from "@/lib/supabase";

export function FormularioAcceso({ modo }: { modo: "entrar" | "registro" }) {
  const router = useRouter();
  const params = useSearchParams();
  const destino = params.get("siguiente") || "/panel";
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const sb = supabase();
      if (modo === "registro") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password: clave,
          options: { data: { nombre: nombre.trim() }, emailRedirectTo: `${window.location.origin}/alta` },
        });
        if (error) throw error;
        if (!data.session) {
          setAviso("Te enviamos un correo para confirmar tu cuenta. Ábrelo y sigue el enlace.");
          return;
        }
        router.replace("/alta");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: clave });
        if (error) throw error;
        router.replace(destino);
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function recuperar() {
    setError(null);
    if (!email.trim()) {
      setError("Escribe tu correo y vuelve a intentarlo.");
      return;
    }
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/entrar`,
    });
    if (error) setError(mensajeError(error));
    else setAviso("Si el correo está registrado, te llegará un enlace para cambiar tu contraseña.");
  }

  const registro = modo === "registro";
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="/">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-semibold tracking-tight">{registro ? "Crea tu cuenta" : "Bienvenido de vuelta"}</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {registro ? "30 días gratis. Sin tarjeta." : "Entra para ver la agenda de tu taller."}
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-4">
            {registro && (
              <Campo etiqueta="Tu nombre">
                <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" placeholder="Nombre y apellido" />
              </Campo>
            )}
            <Campo etiqueta="Correo">
              <Entrada
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@correo.com"
              />
            </Campo>
            <Campo etiqueta="Contraseña" ayuda={registro ? "Mínimo 6 caracteres." : undefined}>
              <Entrada
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                required
                minLength={6}
                autoComplete={registro ? "new-password" : "current-password"}
              />
            </Campo>
            {error && <Aviso tono="error">{error}</Aviso>}
            {aviso && <Aviso tono="exito">{aviso}</Aviso>}
            <Boton type="submit" variante="oscuro" tam="lg" className="w-full" cargando={cargando}>
              {registro ? "Crear cuenta" : "Entrar"}
            </Boton>
          </form>

          <div className="mt-6 space-y-2 text-sm text-muted">
            {registro ? (
              <p>
                ¿Ya tienes cuenta?{" "}
                <Link href="/entrar" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
                  Entrar
                </Link>
              </p>
            ) : (
              <>
                <p>
                  ¿Aún no tienes cuenta?{" "}
                  <Link href="/registro" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
                    Crear cuenta
                  </Link>
                </p>
                <button type="button" onClick={recuperar} className="font-medium text-zinc-700 underline-offset-4 hover:underline">
                  Olvidé mi contraseña
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-zinc-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_70%_20%,rgba(225,29,46,0.35),transparent_70%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            “La agenda llena sin saturar el taller: cada cita respeta las bahías que de verdad tenemos.”
          </p>
          <p className="mt-4 text-sm text-zinc-400">Hecho para el día a día de un taller real.</p>
          <div className="mt-10 grid grid-cols-7 gap-1.5">
            {[1, 1, 0, 1, 1, 0, 1].map((o, i) => (
              <div key={i} className={`h-10 rounded-xl ${o ? "bg-[#E11D2E]" : "bg-white/10"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
