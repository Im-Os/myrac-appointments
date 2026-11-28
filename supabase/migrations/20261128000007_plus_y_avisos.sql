-- MYRAC APPOINTMENTS — Plan Plus (mensual / anual), precio fundador y avisos al cliente
-- Decisiones de Oscar (28-nov-2026):
--   * Un solo plan por ahora: Plus $299/mes o $2,990/año (2 meses gratis). Pro se oculta.
--   * Precio fundador para los primeros 15 talleres que se suscriban: conservan su precio para siempre.

-- Planes ------------------------------------------------------------------------------
alter table planes add column if not exists frecuencia_meses int not null default 1 check (frecuencia_meses in (1, 12));

update planes set nombre = 'Plus', precio_mensual = 299, moneda = 'MXN', frecuencia_meses = 1, activo = true where id = 'basico';
update planes set activo = false where id = 'pro';
insert into planes (id, nombre, precio_mensual, moneda, frecuencia_meses, activo)
values ('plus_anual', 'Plus anual', 2990, 'MXN', 12, true)
on conflict (id) do update set nombre = excluded.nombre, precio_mensual = excluded.precio_mensual,
  frecuencia_meses = excluded.frecuencia_meses, activo = true;

comment on column planes.precio_mensual is 'Precio de cada cobro (mensual o anual según frecuencia_meses).';

-- Precio fundador ---------------------------------------------------------------------
alter table suscripciones add column if not exists fundador boolean not null default false;
-- Cambio de plan: la suscripción nueva queda aquí hasta que Mercado Pago la autoriza.
alter table suscripciones add column if not exists mp_preapproval_nuevo text;

create or replace function lugares_fundador() returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, 15 - (select count(*) from suscripciones where fundador))::int;
$$;
revoke execute on function lugares_fundador() from public;
grant execute on function lugares_fundador() to anon, authenticated;

-- Avisos al cliente (correo) ----------------------------------------------------------
-- Guarda el último estado/horario avisado para no repetir correos.
alter table citas add column if not exists aviso_estado estado_cita;
alter table citas add column if not exists aviso_inicio timestamptz;
