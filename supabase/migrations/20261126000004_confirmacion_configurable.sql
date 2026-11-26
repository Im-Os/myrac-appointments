-- MYRAC APPOINTMENTS — Confirmación automática como opción de la configuración del negocio
--
-- talleres.confirmacion_automatica (editable solo por el dueño, ver política talleres_dueno_edita):
--   activada    → la cita en línea nace "confirmada".
--   desactivada → la cita nace "pendiente" y el taller la confirma (confirmar_cita) o la cancela.
-- En ambos casos la cita aparta su lugar desde que se crea: una cita pendiente
-- ocupa cupo y bahía igual que una confirmada, para evitar sobrecupo.

-- Valor inicial: confirmación a mano (decisión de Oscar, 26-nov-2026).
-- Al crear la cuenta, la app sugiere que se puede activar la confirmación automática.
alter table talleres alter column confirmacion_automatica set default false;

comment on column talleres.confirmacion_automatica is
  'Configuración del negocio: true = las citas en línea se confirman solas; false = el taller las confirma a mano.';

-- El taller confirma una cita pendiente ----------------------------------------
create or replace function confirmar_cita(p_cita_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare c citas;
begin
  select * into c from citas where id = p_cita_id;
  if not found or not es_miembro(c.taller_id) then raise exception 'SIN_PERMISO'; end if;
  if c.estado <> 'pendiente' then raise exception 'CITA_NO_CONFIRMABLE'; end if;
  update citas set estado = 'confirmada' where id = c.id;
end;
$$;

-- Reprogramar por enlace: si el taller confirma a mano, la cita movida vuelve a
-- "pendiente" para que el taller apruebe el nuevo horario.
create or replace function reprogramar_cita_publica(p_token uuid, p_nuevo_inicio timestamptz) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  c citas;
  t talleres;
begin
  select * into c from citas where token_cliente = p_token;
  if not found or c.estado not in ('pendiente', 'confirmada') or c.inicio <= now() then
    raise exception 'CITA_NO_REPROGRAMABLE';
  end if;
  select * into t from talleres where id = c.taller_id;

  perform pg_advisory_xact_lock(hashtextextended(t.id::text, 0));

  -- Se libera su lugar actual mientras se valida el nuevo; si falla, todo se revierte.
  update citas set estado = 'cancelada' where id = c.id;

  if not exists (
    select 1 from horarios_disponibles(t.slug, c.servicio_id,
                    (p_nuevo_inicio at time zone t.zona_horaria)::date,
                    (p_nuevo_inicio at time zone t.zona_horaria)::date) h
    where h.inicio = p_nuevo_inicio
  ) then
    raise exception 'HORARIO_NO_DISPONIBLE';
  end if;

  update citas
  set inicio = p_nuevo_inicio,
      estado = case when t.confirmacion_automatica then 'confirmada'::estado_cita else 'pendiente'::estado_cita end
  where id = c.id;
end;
$$;

revoke execute on function confirmar_cita(uuid) from public;
grant execute on function confirmar_cita(uuid) to authenticated;
