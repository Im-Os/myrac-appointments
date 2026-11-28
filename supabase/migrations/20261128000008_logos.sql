-- MYRAC APPOINTMENTS — Logo de cada taller (pedido por Oscar, 28-nov-2026)
-- Se guarda en Supabase Storage (bucket público "logos", carpeta = id del taller).
-- Solo el dueño del taller puede subir, reemplazar o borrar su logo.

alter table talleres add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ¿El usuario es dueño del taller cuya carpeta es esta? (tolera nombres que no son uuid)
create or replace function es_dueno_carpeta(p_carpeta text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_carpeta ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and es_dueno(p_carpeta::uuid);
$$;

drop policy if exists logos_dueno_sube on storage.objects;
drop policy if exists logos_dueno_actualiza on storage.objects;
drop policy if exists logos_dueno_borra on storage.objects;
create policy logos_dueno_sube on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and es_dueno_carpeta((storage.foldername(name))[1]));
create policy logos_dueno_actualiza on storage.objects for update to authenticated
  using (bucket_id = 'logos' and es_dueno_carpeta((storage.foldername(name))[1]));
create policy logos_dueno_borra on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and es_dueno_carpeta((storage.foldername(name))[1]));

-- Datos públicos y selector de talleres con el logo -------------------------------------
drop function if exists taller_publico(text);
create function taller_publico(p_slug text)
returns table (
  id uuid, nombre text, slug text, telefono text, direccion text, descripcion text,
  color_marca text, logo_url text, zona_horaria text, intervalo_min int, dias_anticipacion_max int,
  confirmacion_automatica boolean, acepta_citas boolean
)
language sql stable security definer set search_path = public as $$
  select t.id, t.nombre, t.slug, t.telefono, t.direccion, t.descripcion,
         t.color_marca, t.logo_url, t.zona_horaria, t.intervalo_min, t.dias_anticipacion_max,
         t.confirmacion_automatica,
         exists (select 1 from suscripciones su where su.taller_id = t.id
                 and su.estado in ('prueba', 'activa')
                 and (su.vence_en is null or su.vence_en > now()))
  from talleres t where t.slug = lower(p_slug);
$$;
revoke execute on function taller_publico(text) from public;
grant execute on function taller_publico(text) to anon, authenticated;

drop function if exists mis_talleres();
create function mis_talleres()
returns table (taller_id uuid, nombre text, slug text, rol rol_taller, color_marca text, logo_url text, zona_horaria text)
language sql stable security definer set search_path = public as $$
  select t.id, t.nombre, t.slug, u.rol, t.color_marca, t.logo_url, t.zona_horaria
  from usuarios_taller u join talleres t on t.id = u.taller_id
  where u.auth_user_id = auth.uid()
  order by t.nombre;
$$;
revoke execute on function mis_talleres() from public;
grant execute on function mis_talleres() to authenticated;
