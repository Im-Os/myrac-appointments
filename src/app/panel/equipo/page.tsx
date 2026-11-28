"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, UserPlus, X } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { Aviso, Boton, Campo, Cargando, EncabezadoPagina, Entrada, Selector, Tarjeta, useAvisos } from "@/components/ui";
import { ROLES } from "@/lib/estados";
import { mensajeError, supabase } from "@/lib/supabase";
import type { Rol } from "@/lib/tipos";

type Miembro = { auth_user_id: string; nombre: string; email: string; rol: Rol };

export default function Equipo() {
  const { taller, esDueno, usuario } = usePanel();
  const avisar = useAvisos();
  const [lista, setLista] = useState<Miembro[] | null>(null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("recepcion");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase().rpc("equipo_taller", { p_taller_id: taller.id });
    if (error) avisar(mensajeError(error), "error");
    setLista((data ?? []) as Miembro[]);
  }, [taller.id, avisar]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function agregar(correo: string, r: Rol, silencioso = false) {
    setError(null);
    setGuardando(true);
    const { error } = await supabase().rpc("agregar_miembro", { p_taller_id: taller.id, p_email: correo, p_rol: r });
    setGuardando(false);
    if (error) {
      if (silencioso) return avisar(mensajeError(error), "error");
      return setError(mensajeError(error));
    }
    if (!silencioso) {
      setEmail("");
      avisar("Persona agregada al equipo");
    }
    cargar();
  }

  async function quitar(m: Miembro) {
    if (!confirm(`¿Quitar a ${m.nombre} del equipo?`)) return;
    const { error } = await supabase().rpc("quitar_miembro", { p_taller_id: taller.id, p_user: m.auth_user_id });
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  const registro = typeof window !== "undefined" ? `${window.location.origin}/registro` : "/registro";

  return (
    <div className="max-w-3xl">
      <EncabezadoPagina titulo="Equipo" descripcion="Quién puede ver la agenda y operar el taller." />

      {esDueno && (
        <Tarjeta className="mb-6 space-y-4 p-5">
          <h2 className="font-semibold">Agregar a alguien</h2>
          <p className="text-sm text-muted">
            La persona debe crear su cuenta primero. Mándale este enlace:{" "}
            <button
              onClick={() => {
                navigator.clipboard.writeText(registro);
                avisar("Enlace copiado");
              }}
              className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:underline"
            >
              {registro.replace(/^https?:\/\//, "")} <Copy className="size-3.5" />
            </button>
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Campo etiqueta="Correo de su cuenta">
              <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@correo.com" />
            </Campo>
            <Campo etiqueta="Rol">
              <Selector value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                {(Object.keys(ROLES) as Rol[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r].etiqueta}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Boton onClick={() => agregar(email, rol)} cargando={guardando} disabled={!email.includes("@")} variante="oscuro" icono={<UserPlus className="size-4" />}>
              Agregar
            </Boton>
          </div>
          {error && <Aviso tono="error">{error}</Aviso>}
        </Tarjeta>
      )}

      {!lista ? (
        <Cargando />
      ) : (
        <Tarjeta className="divide-y divide-line">
          {lista.map((m) => (
            <div key={m.auth_user_id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <span className="grid size-10 place-items-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">{m.nombre.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.nombre} {m.auth_user_id === usuario.id && <span className="text-sm font-normal text-muted">(tú)</span>}
                </p>
                <p className="truncate text-sm text-muted">{m.email}</p>
              </div>
              {esDueno && m.auth_user_id !== usuario.id ? (
                <>
                  <Selector value={m.rol} onChange={(e) => agregar(m.email, e.target.value as Rol, true)} className="h-9 w-36 text-sm">
                    {(Object.keys(ROLES) as Rol[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLES[r].etiqueta}
                      </option>
                    ))}
                  </Selector>
                  <button onClick={() => quitar(m)} className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Quitar">
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">{ROLES[m.rol].etiqueta}</span>
              )}
            </div>
          ))}
        </Tarjeta>
      )}

      <div className="mt-6 grid gap-2 text-sm text-muted sm:grid-cols-3">
        {(Object.keys(ROLES) as Rol[]).map((r) => (
          <p key={r}>
            <span className="font-medium text-zinc-800">{ROLES[r].etiqueta}:</span> {ROLES[r].descripcion}.
          </p>
        ))}
      </div>
    </div>
  );
}
