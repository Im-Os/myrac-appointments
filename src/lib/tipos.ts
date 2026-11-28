export type Rol = "dueno" | "recepcion" | "mecanico";
export type TipoServicio = "espera" | "deja_auto";
export type EstadoCita = "pendiente" | "confirmada" | "recibida" | "cancelada" | "no_asistio";
export type EstadoEstancia = "diagnostico" | "esperando_refacciones" | "en_reparacion" | "listo" | "entregado";

export type MiTaller = {
  taller_id: string;
  nombre: string;
  slug: string;
  rol: Rol;
  color_marca: string;
  zona_horaria: string;
};

export type Taller = {
  id: string;
  nombre: string;
  slug: string;
  telefono: string | null;
  direccion: string | null;
  descripcion: string | null;
  color_marca: string;
  zona_horaria: string;
  bahias_total: number;
  intervalo_min: number;
  cupo_por_bloque: number;
  dias_anticipacion_max: number;
  confirmacion_automatica: boolean;
};

export type TallerPublico = Pick<
  Taller,
  | "id"
  | "nombre"
  | "slug"
  | "telefono"
  | "direccion"
  | "descripcion"
  | "color_marca"
  | "zona_horaria"
  | "intervalo_min"
  | "dias_anticipacion_max"
  | "confirmacion_automatica"
> & { acepta_citas: boolean };

export type Categoria = { id: string; nombre: string; orden: number };

export type Servicio = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  tipo: TipoServicio;
  activo: boolean;
  orden: number;
};

export type Horario = { dia_semana: number; abre: string; cierra: string };

export type Bloqueo = { id: string; inicio: string; fin: string; motivo: string | null };

export type CitaAgenda = {
  id: string;
  inicio: string;
  estado: EstadoCita;
  origen: "web" | "taller";
  notas: string | null;
  creado_en: string;
  cliente: { id: string; nombre: string; telefono: string; email: string | null } | null;
  vehiculo: { id: string; marca: string; modelo: string; anio: number | null; placas: string | null } | null;
  servicio: { id: string; nombre: string; tipo: TipoServicio } | null;
};

export type Estancia = {
  id: string;
  cita_id: string | null;
  bahia: number | null;
  ingreso: string;
  salida_estimada: string | null;
  salida_real: string | null;
  estado: EstadoEstancia;
  notas: string | null;
  vehiculo: { marca: string; modelo: string; anio: number | null; placas: string | null; cliente: { nombre: string; telefono: string } | null } | null;
  cita: { servicio: { nombre: string } | null } | null;
};

export type Slot = { inicio: string; cupos_libres: number };
