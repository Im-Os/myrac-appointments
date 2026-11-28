-- MYRAC APPOINTMENTS — Suscripciones de talleres con Mercado Pago
--   * Precios de los planes (decisión de Oscar, 28-nov-2026): Citas $299, Citas + operación $599 MXN/mes.
--   * La suscripción guarda el id de Mercado Pago (preapproval) y su estado.
--   * Historial de cobros recurrentes.
-- Las escrituras las hace solo el servidor (llave secreta); los miembros del taller solo leen.

update planes set precio_mensual = 299, moneda = 'MXN' where id = 'basico';
update planes set precio_mensual = 599, moneda = 'MXN' where id = 'pro';

alter table suscripciones add column if not exists mp_preapproval_id text unique;
alter table suscripciones add column if not exists mp_estado text;            -- pending / authorized / paused / cancelled
alter table suscripciones add column if not exists mp_plan_pendiente text references planes(id);
alter table suscripciones add column if not exists actualizado_en timestamptz not null default now();

create table if not exists pagos_suscripcion (
  id          text primary key,                 -- id del cobro autorizado en Mercado Pago
  taller_id   uuid not null references talleres(id) on delete cascade,
  monto       numeric(10,2),
  moneda      text,
  estado      text,                             -- approved, rejected, ...
  fecha       timestamptz,
  creado_en   timestamptz not null default now()
);
create index if not exists pagos_suscripcion_taller on pagos_suscripcion (taller_id, fecha desc);

alter table pagos_suscripcion enable row level security;
create policy pagos_miembros_ven on pagos_suscripcion for select using (es_miembro(taller_id));
