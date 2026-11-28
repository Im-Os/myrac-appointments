"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { usePanel } from "@/components/panel-contexto";
import { Boton, Cargando, EncabezadoPagina, Entrada, Interruptor, Tarjeta, Vacio, cx, useAvisos } from "@/components/ui";
import { TIPO_SERVICIO } from "@/lib/estados";
import { mensajeError, supabase } from "@/lib/supabase";
import type { Categoria, Servicio, TipoServicio } from "@/lib/tipos";

export default function Servicios() {
  const { taller, esDueno } = usePanel();
  const avisar = useAvisos();
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [nuevaCat, setNuevaCat] = useState("");

  const cargar = useCallback(async () => {
    const sb = supabase();
    const [c, s] = await Promise.all([
      sb.from("categorias_servicio").select("id,nombre,orden").eq("taller_id", taller.id).order("orden"),
      sb.from("servicios").select("id,categoria_id,nombre,tipo,activo,orden").eq("taller_id", taller.id).order("orden"),
    ]);
    setCategorias((c.data ?? []) as Categoria[]);
    setServicios((s.data ?? []) as Servicio[]);
  }, [taller.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function actualizar(id: string, cambios: Partial<Servicio>) {
    setServicios((l) => l.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
    const { error } = await supabase().from("servicios").update(cambios).eq("id", id);
    if (error) {
      avisar(mensajeError(error), "error");
      cargar();
    }
  }

  async function agregarServicio(categoriaId: string | null, nombre: string) {
    const orden = Math.max(0, ...servicios.filter((s) => s.categoria_id === categoriaId).map((s) => s.orden)) + 1;
    const { error } = await supabase().from("servicios").insert({ taller_id: taller.id, categoria_id: categoriaId, nombre: nombre.trim(), tipo: "deja_auto", orden });
    if (error) return avisar(mensajeError(error), "error");
    avisar("Servicio agregado");
    cargar();
  }

  async function eliminar(s: Servicio) {
    if (!confirm(`¿Eliminar “${s.nombre}”?`)) return;
    const { error } = await supabase().from("servicios").delete().eq("id", s.id);
    if (error) {
      await actualizar(s.id, { activo: false });
      return avisar("Tiene citas registradas: lo desactivamos en lugar de borrarlo.");
    }
    cargar();
  }

  async function agregarCategoria() {
    if (!nuevaCat.trim()) return;
    const orden = Math.max(0, ...(categorias ?? []).map((c) => c.orden)) + 1;
    const { error } = await supabase().from("categorias_servicio").insert({ taller_id: taller.id, nombre: nuevaCat.trim(), orden });
    if (error) return avisar(mensajeError(error), "error");
    setNuevaCat("");
    cargar();
  }

  async function renombrarCategoria(id: string, nombre: string) {
    const { error } = await supabase().from("categorias_servicio").update({ nombre }).eq("id", id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  async function eliminarCategoria(c: Categoria) {
    const n = servicios.filter((s) => s.categoria_id === c.id).length;
    if (!confirm(n ? `¿Eliminar la categoría “${c.nombre}”? Sus ${n} servicios pasarán a “Otros”.` : `¿Eliminar la categoría “${c.nombre}”?`)) return;
    const { error } = await supabase().from("categorias_servicio").delete().eq("id", c.id);
    if (error) return avisar(mensajeError(error), "error");
    cargar();
  }

  if (!esDueno) return <Vacio titulo="Solo el dueño puede editar los servicios" />;
  if (!categorias) return <Cargando />;

  const grupos = [...categorias.map((c) => ({ cat: c as Categoria | null })), { cat: null }]
    .map(({ cat }) => ({ cat, lista: servicios.filter((s) => (s.categoria_id ?? null) === (cat?.id ?? null)) }))
    .filter((g) => g.cat || g.lista.length);
  const activos = servicios.filter((s) => s.activo).length;

  return (
    <div>
      <EncabezadoPagina
        titulo="Servicios"
        descripcion={`${activos} de ${servicios.length} servicios visibles en tu página. Desactiva los que no haces.`}
      />

      <Tarjeta className="mb-6 grid gap-3 p-4 text-sm sm:grid-cols-2">
        {(Object.keys(TIPO_SERVICIO) as TipoServicio[]).map((t) => (
          <div key={t} className="flex gap-3">
            <span className={cx("mt-0.5 h-5 shrink-0 rounded-md px-1.5 text-[11px] font-semibold leading-5", t === "deja_auto" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700")}>
              {t === "deja_auto" ? "D" : "E"}
            </span>
            <p>
              <span className="font-medium">{TIPO_SERVICIO[t].etiqueta}:</span> <span className="text-muted">{TIPO_SERVICIO[t].descripcion}.</span>
            </p>
          </div>
        ))}
      </Tarjeta>

      <div className="space-y-5">
        {grupos.map(({ cat, lista }) => (
          <GrupoCategoria
            key={cat?.id ?? "otros"}
            categoria={cat}
            servicios={lista}
            onActualizar={actualizar}
            onAgregar={(n) => agregarServicio(cat?.id ?? null, n)}
            onEliminar={eliminar}
            onRenombrar={(n) => cat && renombrarCategoria(cat.id, n)}
            onEliminarCategoria={() => cat && eliminarCategoria(cat)}
          />
        ))}
      </div>

      <Tarjeta className="mt-6 flex flex-wrap items-center gap-2 p-4">
        <Entrada value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} placeholder="Nueva categoría (ej. Hojalatería)" className="max-w-xs" onKeyDown={(e) => e.key === "Enter" && agregarCategoria()} />
        <Boton variante="secundario" icono={<Plus className="size-4" />} onClick={agregarCategoria}>
          Agregar categoría
        </Boton>
      </Tarjeta>
    </div>
  );
}

function GrupoCategoria({
  categoria,
  servicios,
  onActualizar,
  onAgregar,
  onEliminar,
  onRenombrar,
  onEliminarCategoria,
}: {
  categoria: Categoria | null;
  servicios: Servicio[];
  onActualizar: (id: string, c: Partial<Servicio>) => void;
  onAgregar: (nombre: string) => void;
  onEliminar: (s: Servicio) => void;
  onRenombrar: (n: string) => void;
  onEliminarCategoria: () => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const [editando, setEditando] = useState(false);
  const [nombreCat, setNombreCat] = useState(categoria?.nombre ?? "");
  const activos = servicios.filter((s) => s.activo).length;

  return (
    <Tarjeta className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-zinc-50/70 px-4 py-3">
        {editando && categoria ? (
          <>
            <Entrada value={nombreCat} onChange={(e) => setNombreCat(e.target.value)} className="h-9 max-w-xs" autoFocus />
            <button
              onClick={() => {
                onRenombrar(nombreCat.trim());
                setEditando(false);
              }}
              className="grid size-8 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50"
              aria-label="Guardar nombre"
            >
              <Check className="size-4" />
            </button>
            <button onClick={() => setEditando(false)} className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100" aria-label="Cancelar">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <h2 className="font-semibold">{categoria?.nombre ?? "Otros"}</h2>
            <span className="text-sm text-muted">
              {activos}/{servicios.length}
            </span>
            {categoria && (
              <div className="ml-auto flex">
                <button onClick={() => setEditando(true)} className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Renombrar categoría">
                  <Pencil className="size-4" />
                </button>
                <button onClick={onEliminarCategoria} className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar categoría">
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <ul className="divide-y divide-line">
        {servicios.map((s) => (
          <FilaServicio key={s.id} s={s} onActualizar={onActualizar} onEliminar={onEliminar} />
        ))}
      </ul>
      <div className="flex gap-2 border-t border-line p-3">
        <Entrada
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Agregar servicio…"
          className="h-10"
          onKeyDown={(e) => {
            if (e.key === "Enter" && nuevo.trim()) {
              onAgregar(nuevo);
              setNuevo("");
            }
          }}
        />
        <Boton
          variante="secundario"
          disabled={!nuevo.trim()}
          onClick={() => {
            onAgregar(nuevo);
            setNuevo("");
          }}
          aria-label="Agregar servicio"
        >
          <Plus className="size-4" />
        </Boton>
      </div>
    </Tarjeta>
  );
}

function FilaServicio({ s, onActualizar, onEliminar }: { s: Servicio; onActualizar: (id: string, c: Partial<Servicio>) => void; onEliminar: (s: Servicio) => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(s.nombre);
  return (
    <li className={cx("flex flex-wrap items-center gap-3 px-4 py-2.5", !s.activo && "bg-zinc-50/50")}>
      <Interruptor activo={s.activo} onCambio={(v) => onActualizar(s.id, { activo: v })} etiqueta={`Mostrar ${s.nombre}`} />
      {editando ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-9" autoFocus />
          <button
            onClick={() => {
              if (nombre.trim()) onActualizar(s.id, { nombre: nombre.trim() });
              setEditando(false);
            }}
            className="grid size-8 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50"
            aria-label="Guardar"
          >
            <Check className="size-4" />
          </button>
        </div>
      ) : (
        <button onClick={() => setEditando(true)} className={cx("min-w-0 flex-1 truncate text-left text-[15px]", !s.activo && "text-zinc-400")}>
          {s.nombre}
        </button>
      )}
      <div className="flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
        {(Object.keys(TIPO_SERVICIO) as TipoServicio[]).map((t) => (
          <button
            key={t}
            onClick={() => onActualizar(s.id, { tipo: t })}
            className={cx("rounded-md px-2 py-1", s.tipo === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
          >
            {TIPO_SERVICIO[t].etiqueta}
          </button>
        ))}
      </div>
      <button onClick={() => onEliminar(s)} className="grid size-8 place-items-center rounded-lg text-zinc-300 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar servicio">
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
