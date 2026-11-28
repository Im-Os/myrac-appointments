-- MYRAC APPOINTMENTS — Súper admin de la plataforma (pedido por Oscar, 28-nov-2026)
-- Los administradores usan su propia cuenta; no hay usuarios ni contraseñas aparte.
-- Todo el acceso de administración pasa por el servidor (llave secreta) y queda en una bitácora.

create table if not exists plataforma_admins (
  auth_user_id  uuid primary key references auth.users(id) on delete cascade,
  creado_en     timestamptz not null default now()
);
alter table plataforma_admins enable row level security; -- sin políticas: solo el servidor

create table if not exists admin_bitacora (
  id         bigserial primary key,
  admin_id   uuid references auth.users(id) on delete set null,
  accion     text not null,
  taller_id  uuid references talleres(id) on delete set null,
  detalle    jsonb,
  creado_en  timestamptz not null default now()
);
alter table admin_bitacora enable row level security; -- sin políticas: solo el servidor

-- ¿La cuenta actual es admin de la plataforma? (para mostrar el acceso en el panel)
create or replace function soy_admin_plataforma() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins where auth_user_id = auth.uid());
$$;
revoke execute on function soy_admin_plataforma() from public;
grant execute on function soy_admin_plataforma() to authenticated;

-- Vista completa de talleres para el admin (solo el servidor puede llamarla)
create or replace function admin_talleres()
returns table (
  id uuid, nombre text, slug text, logo_url text, color_marca text, telefono text, creado_en timestamptz,
  estado text, plan_id text, vence_en timestamptz, mp_estado text, fundador boolean,
  duenos text, miembros int, citas_30d int, citas_total int, ultima_cita timestamptz
)
language sql stable security definer set search_path = public as $$
  select t.id, t.nombre, t.slug, t.logo_url, t.color_marca, t.telefono, t.creado_en,
         s.estado::text, s.plan_id, s.vence_en, s.mp_estado, coalesce(s.fundador, false),
         (select string_agg(au.email, ', ' order by au.email)
            from usuarios_taller u join auth.users au on au.id = u.auth_user_id
           where u.taller_id = t.id and u.rol = 'dueno'),
         (select count(*) from usuarios_taller u where u.taller_id = t.id)::int,
         (select count(*) from citas c where c.taller_id = t.id and c.creado_en > now() - interval '30 days')::int,
         (select count(*) from citas c where c.taller_id = t.id)::int,
         (select max(c.creado_en) from citas c where c.taller_id = t.id)
  from talleres t left join suscripciones s on s.taller_id = t.id
  order by t.creado_en desc;
$$;

create or replace function admin_lista_admins()
returns table (auth_user_id uuid, email text, nombre text, creado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select a.auth_user_id, au.email::text, coalesce(au.raw_user_meta_data->>'nombre', au.email)::text, a.creado_en
  from plataforma_admins a join auth.users au on au.id = a.auth_user_id
  order by a.creado_en;
$$;

create or replace function admin_buscar_usuario(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(trim(p_email));
$$;

revoke execute on function admin_talleres() from public, anon, authenticated;
revoke execute on function admin_lista_admins() from public, anon, authenticated;
revoke execute on function admin_buscar_usuario(text) from public, anon, authenticated;
grant execute on function admin_talleres() to service_role;
grant execute on function admin_lista_admins() to service_role;
grant execute on function admin_buscar_usuario(text) to service_role;
grant execute on function aplicar_plantilla_servicios(uuid) to service_role;

-- Primer admin: la cuenta de Oscar (dueña de Os AutoTech).
insert into plataforma_admins (auth_user_id)
select u.auth_user_id from usuarios_taller u join talleres t on t.id = u.taller_id
where t.slug = 'os-autotech' and u.rol = 'dueno'
on conflict do nothing;
