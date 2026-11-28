"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { MiTaller, Taller } from "@/lib/tipos";

type Ctx = {
  usuario: User;
  talleres: MiTaller[];
  taller: Taller;
  rol: MiTaller["rol"];
  esDueno: boolean;
  cambiarTaller: (id: string) => void;
  recargarTaller: () => Promise<void>;
};

const PanelCtx = createContext<Ctx | null>(null);

export function usePanel() {
  const c = useContext(PanelCtx);
  if (!c) throw new Error("usePanel fuera del panel");
  return c;
}

export function ProveedorPanel({ children, cargando }: { children: ReactNode; cargando: ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(null);
  const [talleres, setTalleres] = useState<MiTaller[] | null>(null);
  const [taller, setTaller] = useState<Taller | null>(null);
  const [activoId, setActivoId] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    let vivo = true;
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        router.replace(`/entrar?siguiente=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!vivo) return;
      setUsuario(data.session.user);
      const { data: lista } = await sb.rpc("mis_talleres");
      const ts = (lista ?? []) as MiTaller[];
      if (!ts.length) {
        router.replace("/alta");
        return;
      }
      setTalleres(ts);
      const guardado = localStorage.getItem("taller_activo");
      setActivoId(ts.find((t) => t.taller_id === guardado)?.taller_id ?? ts[0].taller_id);
    })();
    const { data: sub } = sb.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") router.replace("/entrar");
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const recargarTaller = useCallback(async () => {
    if (!activoId) return;
    const { data } = await supabase().from("talleres").select("*").eq("id", activoId).single();
    if (data) setTaller(data as Taller);
    const { data: lista } = await supabase().rpc("mis_talleres");
    if (lista) setTalleres(lista as MiTaller[]);
  }, [activoId]);

  useEffect(() => {
    if (!activoId) return;
    localStorage.setItem("taller_activo", activoId);
    setTaller(null);
    supabase()
      .from("talleres")
      .select("*")
      .eq("id", activoId)
      .single()
      .then(({ data }) => data && setTaller(data as Taller));
  }, [activoId]);

  if (!usuario || !talleres || !taller) return <>{cargando}</>;
  const rol = talleres.find((t) => t.taller_id === taller.id)?.rol ?? "recepcion";

  return (
    <PanelCtx
      value={{
        usuario,
        talleres,
        taller,
        rol,
        esDueno: rol === "dueno",
        cambiarTaller: setActivoId,
        recargarTaller,
      }}
    >
      {children}
    </PanelCtx>
  );
}
