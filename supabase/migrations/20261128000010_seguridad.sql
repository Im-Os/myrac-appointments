-- MYRAC APPOINTMENTS — Endurecimiento de seguridad (auditoría del 28-nov-2026)
--
-- Hallazgos que corrige:
--   1. Supabase da permiso de ejecutar TODAS las funciones a "anon" (visitantes sin sesión)
--      aunque las migraciones hicieran "revoke ... from public". Casi todas validan permisos
--      por dentro, pero aplicar_plantilla_servicios no: cualquiera podía meter el catálogo
--      de servicios en cualquier taller. Ahora anon solo ejecuta lo que la página pública usa.
--   2. Cualquiera podía llenar la agenda de un taller con citas falsas (bots). Ahora hay
--      límites: máximo 3 citas activas por cliente y 30 citas web por hora por taller.
--   3. El bucket de logos aceptaba cualquier tipo de archivo y tamaño. Ahora solo imágenes ≤ 1 MB.
--   4. La revisión diaria no tenía freno. Se agrega un registro para limitar su frecuencia.

-- 1) Permisos de funciones ---------------------------------------------------------------
-- Las funciones nuevas ya no serán ejecutables por visitantes salvo que se otorgue explícitamente.
alter default privileges in schema public revoke execute on functions from anon;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname not in (
         -- Lo que usa la página pública de citas (sin sesión)
         'taller_publico', 'horarios_disponibles', 'crear_cita_publica', 'cita_por_token',
         'cancelar_cita_publica', 'reprogramar_cita_publica', 'lugares_fundador',
         -- Ayudantes de las políticas RLS (solo responden sobre quien llama)
         'es_miembro', 'es_dueno', 'es_dueno_carpeta', 'solo_digitos', 'hoy_taller'
       )
       and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from anon', f.firma);
  end loop;
end $$;

-- Solo el sistema (crear_taller por dentro y el admin con la llave secreta) aplica la plantilla.
revoke execute on function aplicar_plantilla_servicios(uuid) from public, anon, authenticated;
grant execute on function aplicar_plantilla_servicios(uuid) to service_role;

-- 2) Freno anti-spam para citas desde la página pública -------------------------------------
create or replace function limitar_citas_web() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.origen <> 'web' then return new; end if;
  if (select count(*) from citas
       where taller_id = new.taller_id and cliente_id = new.cliente_id
         and estado in ('pendiente', 'confirmada') and inicio > now()) >= 3 then
    raise exception 'LIMITE_CITAS_CLIENTE';
  end if;
  if (select count(*) from citas
       where taller_id = new.taller_id and origen = 'web'
         and creado_en > now() - interval '1 hour') >= 30 then
    raise exception 'LIMITE_CITAS_TALLER';
  end if;
  return new;
end;
$$;
revoke execute on function limitar_citas_web() from public, anon, authenticated;

drop trigger if exists citas_limite_web on citas;
create trigger citas_limite_web before insert on citas
  for each row execute function limitar_citas_web();

-- 3) Logos: solo imágenes y máximo 1 MB ----------------------------------------------------
update storage.buckets
   set file_size_limit = 1048576,
       allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg']
 where id = 'logos';

-- 4) Registro de tareas programadas (frena ejecuciones repetidas de la revisión diaria) -----
create table if not exists tareas_programadas (
  nombre   text primary key,
  ultima   timestamptz not null
);
alter table tareas_programadas enable row level security; -- sin políticas: solo el servidor
