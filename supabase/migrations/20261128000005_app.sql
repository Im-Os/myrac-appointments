-- MYRAC APPOINTMENTS — Soporte para la app web (interfaz v1)
--   * Identidad visual por taller (color de marca, descripción).
--   * Slugs reservados por las rutas de la app.
--   * Códigos de alta: reclamar un taller ya cargado (p. ej. MYRAC) desde la app.
--   * Citas creadas por el taller (teléfono / mostrador / auto que llega sin cita).
--   * Equipo del taller y datos públicos de la página de reservas.

-- Identidad visual ---------------------------------------------------------------
alter table talleres add column if not exists color_marca text not null default '#E11D2E'
  check (color_marca ~ '^#[0-9A-Fa-f]{6}$');
alter table talleres add column if not exists descripcion text;

alter table talleres add constraint talleres_slug_no_reservado check (slug not in (
  'panel', 'entrar', 'registro', 'alta', 'cita', 'api', 'admin', 'app', 'login', 'salir',
  'auth', 'precios', 'ayuda', 'soporte', 'manifest', 'icon', 'favicon', 'robots', 'sitemap'
));

-- Nombre visible del miembro al crear su taller ------------------------------------
create or replace function nombre_usuario_actual() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'), ''), u.email)
  from auth.users u where u.id = auth.uid();
$$;

create or replace function crear_taller(p_nombre text, p_slug text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'SIN_SESION'; end if;
  if exists (select 1 from talleres where slug = lower(trim(p_slug))) then raise exception 'SLUG_OCUPADO'; end if;

  insert into talleres (nombre, slug) values (trim(p_nombre), lower(trim(p_slug))) returning id into v_id;
  insert into usuarios_taller (taller_id, auth_user_id, rol, nombre)
  values (v_id, auth.uid(), 'dueno', nombre_usuario_actual());

  insert into horario_taller (taller_id, dia_semana, abre, cierra)
  select v_id, d, '09:00', case when d = 6 then '14:00'::time else '18:00'::time end
  from generate_series(1, 6) d;

  perform aplicar_plantilla_servicios(v_id);

  insert into suscripciones (taller_id, estado, vence_en) values (v_id, 'prueba', now() + interval '30 days');
  return v_id;
end;
$$;

create or replace function slug_disponible(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(trim(p_slug)) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and lower(trim(p_slug)) not in ('panel','entrar','registro','alta','cita','api','admin','app','login','salir',
                                     'auth','precios','ayuda','soporte','manifest','icon','favicon','robots','sitemap')
     and not exists (select 1 from talleres where slug = lower(trim(p_slug)));
$$;

-- Talleres del usuario (selector del panel) --------------------------------------
create or replace function mis_talleres()
returns table (taller_id uuid, nombre text, slug text, rol rol_taller, color_marca text, zona_horaria text)
language sql stable security definer set search_path = public as $$
  select t.id, t.nombre, t.slug, u.rol, t.color_marca, t.zona_horaria
  from usuarios_taller u join talleres t on t.id = u.taller_id
  where u.auth_user_id = auth.uid()
  order by t.nombre;
$$;

-- Códigos de alta ------------------------------------------------------------------
create table if not exists codigos_alta (
  codigo     text primary key,
  taller_id  uuid not null references talleres(id) on delete cascade,
  rol        rol_taller not null default 'dueno',
  creado_en  timestamptz not null default now(),
  usado_en   timestamptz,
  usado_por  uuid references auth.users(id) on delete set null
);
alter table codigos_alta enable row level security; -- sin políticas: solo se usa mediante funciones

create or replace function reclamar_taller(p_codigo text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare c codigos_alta;
begin
  if auth.uid() is null then raise exception 'SIN_SESION'; end if;
  select * into c from codigos_alta
  where codigo = upper(trim(p_codigo)) and usado_en is null
  for update;
  if not found then raise exception 'CODIGO_INVALIDO'; end if;

  insert into usuarios_taller (taller_id, auth_user_id, rol, nombre)
  values (c.taller_id, auth.uid(), c.rol, nombre_usuario_actual())
  on conflict (taller_id, auth_user_id) do update set rol = excluded.rol;

  update codigos_alta set usado_en = now(), usado_por = auth.uid() where codigo = c.codigo;
  return c.taller_id;
end;
$$;

-- Página pública ---------------------------------------------------------------------
create or replace function taller_publico(p_slug text)
returns table (
  id uuid, nombre text, slug text, telefono text, direccion text, descripcion text,
  color_marca text, zona_horaria text, intervalo_min int, dias_anticipacion_max int,
  confirmacion_automatica boolean, acepta_citas boolean
)
language sql stable security definer set search_path = public as $$
  select t.id, t.nombre, t.slug, t.telefono, t.direccion, t.descripcion,
         t.color_marca, t.zona_horaria, t.intervalo_min, t.dias_anticipacion_max,
         t.confirmacion_automatica,
         exists (select 1 from suscripciones su where su.taller_id = t.id
                 and su.estado in ('prueba', 'activa')
                 and (su.vence_en is null or su.vence_en > now()))
  from talleres t where t.slug = lower(p_slug);
$$;

-- Citas creadas por el taller ------------------------------------------------------
-- El taller puede agendar fuera de la regla de disponibilidad (decide el personal);
-- la app avisa cuando el horario no tiene espacio.
create or replace function crear_cita_taller(
  p_taller_id uuid, p_servicio_id uuid, p_inicio timestamptz,
  p_nombre text, p_telefono text, p_email text,
  p_marca text, p_modelo text, p_anio int, p_placas text,
  p_notas text default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_tel text := solo_digitos(p_telefono);
  v_placas text := nullif(upper(regexp_replace(coalesce(p_placas, ''), '[^A-Za-z0-9]', '', 'g')), '');
  v_cliente uuid;
  v_vehiculo uuid;
  v_cita uuid;
begin
  if not es_miembro(p_taller_id) then raise exception 'SIN_PERMISO'; end if;
  if not exists (select 1 from servicios where id = p_servicio_id and taller_id = p_taller_id) then
    raise exception 'SERVICIO_INVALIDO';
  end if;
  if length(v_tel) <> 10 then raise exception 'TELEFONO_INVALIDO'; end if;
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_marca), '') = '' or coalesce(trim(p_modelo), '') = '' then
    raise exception 'DATOS_INCOMPLETOS';
  end if;

  insert into clientes (taller_id, nombre, telefono, email)
  values (p_taller_id, trim(p_nombre), v_tel, nullif(trim(p_email), ''))
  on conflict (taller_id, telefono) do update
    set nombre = excluded.nombre,
        email  = coalesce(excluded.email, clientes.email)
  returning id into v_cliente;

  select v.id into v_vehiculo from vehiculos v
  where v.cliente_id = v_cliente
    and ((v_placas is not null and v.placas = v_placas)
      or (v_placas is null and lower(v.marca) = lower(trim(p_marca))
          and lower(v.modelo) = lower(trim(p_modelo)) and v.anio is not distinct from p_anio::smallint))
  limit 1;

  if v_vehiculo is null then
    insert into vehiculos (taller_id, cliente_id, marca, modelo, anio, placas)
    values (p_taller_id, v_cliente, trim(p_marca), trim(p_modelo), p_anio, v_placas)
    returning id into v_vehiculo;
  end if;

  insert into citas (taller_id, cliente_id, vehiculo_id, servicio_id, inicio, estado, origen, notas)
  values (p_taller_id, v_cliente, v_vehiculo, p_servicio_id, p_inicio, 'confirmada', 'taller', nullif(trim(p_notas), ''))
  returning id into v_cita;
  return v_cita;
end;
$$;

-- Equipo -----------------------------------------------------------------------------
create or replace function equipo_taller(p_taller_id uuid)
returns table (auth_user_id uuid, nombre text, email text, rol rol_taller)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_miembro(p_taller_id) then raise exception 'SIN_PERMISO'; end if;
  return query
  select u.auth_user_id, coalesce(u.nombre, au.email)::text, au.email::text, u.rol
  from usuarios_taller u join auth.users au on au.id = u.auth_user_id
  where u.taller_id = p_taller_id
  order by u.rol, 2;
end;
$$;

create or replace function agregar_miembro(p_taller_id uuid, p_email text, p_rol rol_taller) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v_user uuid; v_nombre text;
begin
  if not es_dueno(p_taller_id) then raise exception 'SIN_PERMISO'; end if;
  select id, coalesce(nullif(trim(raw_user_meta_data->>'nombre'), ''), email) into v_user, v_nombre
  from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'USUARIO_NO_REGISTRADO'; end if;

  insert into usuarios_taller (taller_id, auth_user_id, rol, nombre)
  values (p_taller_id, v_user, p_rol, v_nombre)
  on conflict (taller_id, auth_user_id) do update set rol = excluded.rol;
end;
$$;

create or replace function quitar_miembro(p_taller_id uuid, p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not es_dueno(p_taller_id) then raise exception 'SIN_PERMISO'; end if;
  if (select rol from usuarios_taller where taller_id = p_taller_id and auth_user_id = p_user) = 'dueno'
     and (select count(*) from usuarios_taller where taller_id = p_taller_id and rol = 'dueno') = 1 then
    raise exception 'ULTIMO_DUENO';
  end if;
  delete from usuarios_taller where taller_id = p_taller_id and auth_user_id = p_user;
end;
$$;

-- Suscripción visible para el taller -------------------------------------------------
-- (la tabla ya es legible por los miembros; los planes son públicos)

-- Permisos -----------------------------------------------------------------------------
revoke execute on function nombre_usuario_actual() from public;
revoke execute on function slug_disponible(text) from public;
revoke execute on function mis_talleres() from public;
revoke execute on function reclamar_taller(text) from public;
revoke execute on function taller_publico(text) from public;
revoke execute on function crear_cita_taller(uuid, uuid, timestamptz, text, text, text, text, text, int, text, text) from public;
revoke execute on function equipo_taller(uuid) from public;
revoke execute on function agregar_miembro(uuid, text, rol_taller) from public;
revoke execute on function quitar_miembro(uuid, uuid) from public;
revoke execute on function confirmar_cita(uuid) from public;

grant execute on function slug_disponible(text) to authenticated;
grant execute on function mis_talleres() to authenticated;
grant execute on function reclamar_taller(text) to authenticated;
grant execute on function taller_publico(text) to anon, authenticated;
grant execute on function crear_cita_taller(uuid, uuid, timestamptz, text, text, text, text, text, int, text, text) to authenticated;
grant execute on function equipo_taller(uuid) to authenticated;
grant execute on function agregar_miembro(uuid, text, rol_taller) to authenticated;
grant execute on function quitar_miembro(uuid, uuid) to authenticated;
grant execute on function confirmar_cita(uuid) to authenticated;
grant execute on function crear_taller(text, text) to authenticated;
