"use client";

import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { LogoTaller } from "@/components/logo-taller";
import { Boton, useAvisos } from "@/components/ui";
import { mensajeError, supabase } from "@/lib/supabase";

const LADO_MAX = 512;

/** Reduce la imagen a 512 px como máximo y la convierte a WebP (conserva transparencia). */
async function prepararImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  return new Promise((res, rej) => lienzo.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la imagen"))), "image/webp", 0.92));
}

function rutaDesdeUrl(url: string | null) {
  const i = url?.indexOf("/logos/") ?? -1;
  return url && i >= 0 ? url.slice(i + "/logos/".length).split("?")[0] : null;
}

export function SubirLogo() {
  const { taller, recargarTaller } = usePanel();
  const avisar = useAvisos();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(archivo: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) return avisar("Usa una imagen PNG, JPG o WebP.", "error");
    if (archivo.size > 10 * 1024 * 1024) return avisar("La imagen pesa demasiado (máximo 10 MB).", "error");
    setSubiendo(true);
    try {
      const sb = supabase();
      const blob = await prepararImagen(archivo);
      const ruta = `${taller.id}/logo-${Date.now()}.webp`;
      const { error } = await sb.storage.from("logos").upload(ruta, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw error;
      const url = sb.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
      const anterior = rutaDesdeUrl(taller.logo_url);
      const { error: e2 } = await sb.from("talleres").update({ logo_url: url }).eq("id", taller.id);
      if (e2) throw e2;
      if (anterior) await sb.storage.from("logos").remove([anterior]);
      await recargarTaller();
      avisar("Logo actualizado");
    } catch (e) {
      avisar(mensajeError(e), "error");
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function quitar() {
    const sb = supabase();
    const anterior = rutaDesdeUrl(taller.logo_url);
    const { error } = await sb.from("talleres").update({ logo_url: null }).eq("id", taller.id);
    if (error) return avisar(mensajeError(error), "error");
    if (anterior) await sb.storage.from("logos").remove([anterior]);
    await recargarTaller();
    avisar("Logo quitado");
  }

  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-zinc-700">Logo del taller</p>
      <div className="flex flex-wrap items-center gap-4">
        <LogoTaller nombre={taller.nombre} logo={taller.logo_url} className="size-20 rounded-2xl text-3xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" tam="sm" icono={<ImageUp className="size-4" />} cargando={subiendo} onClick={() => entrada.current?.click()}>
              {taller.logo_url ? "Cambiar logo" : "Subir logo"}
            </Boton>
            {taller.logo_url && (
              <Boton variante="fantasma" tam="sm" icono={<Trash2 className="size-4" />} onClick={quitar}>
                Quitar
              </Boton>
            )}
          </div>
          <p className="text-xs text-muted">PNG, JPG o WebP. Mejor cuadrado y con fondo transparente o blanco.</p>
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
        />
      </div>
    </div>
  );
}
