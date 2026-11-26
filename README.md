# MYRAC APPOINTMENTS

Plataforma web de citas para talleres automotrices: el cliente ve los horarios con espacio real y el taller administra su agenda y sus bahías. Producto de MYRAC OS, diseñado para integrarse con él más adelante.

## Stack
- **Next.js** (app web responsiva, instalable como PWA): en construcción
- **Supabase**: PostgreSQL, autenticación y tiempo real
- **Stripe**: suscripciones de los talleres (fase posterior)

## Base de datos (`supabase/`)
| Archivo | Contenido |
|---|---|
| `migrations/…_esquema.sql` | Tablas: talleres, horario, bloqueos, usuarios, clientes, vehículos, servicios, citas, estancias, planes y suscripciones |
| `migrations/…_funciones.sql` | Regla de disponibilidad, reserva pública con bloqueo contra doble reserva, cancelar/reprogramar por enlace, recibir y entregar autos, alta de talleres con plantilla de servicios |
| `migrations/…_seguridad.sql` | Row Level Security: cada taller solo ve sus datos; el público solo puede reservar |
| `migrations/…_confirmacion_configurable.sql` | Confirmación automática como opción del taller; función `confirmar_cita` para el taller |
| `seed.sql` | Planes y el taller MYRAC (7 bahías, 3 recepciones cada 30 min, L–V 9–18, S 9–14, 42 servicios) |

### Regla de disponibilidad
Un bloque de horario se ofrece si:
1. Está dentro del horario del taller y no choca con un bloqueo.
2. Las citas de ese bloque son menos que el cupo (`cupo_por_bloque`).
3. Si el servicio deja el auto: las bahías ocupadas proyectadas ese día son menos que `bahias_total`.

**Bahías ocupadas proyectadas** = autos dentro sin fecha estimada de salida, con fecha vencida o con fecha estimada ≥ ese día, más las citas de ese día que dejan el auto.

### Configuración del negocio (la edita el dueño de cada taller)
| Opción | Campo | MYRAC |
|---|---|---|
| Número de bahías | `bahias_total` | 7 |
| Duración del bloque de recepción | `intervalo_min` | 30 min |
| Autos recibidos por bloque | `cupo_por_bloque` | 3 |
| Días máximos de anticipación | `dias_anticipacion_max` | 30 |
| Confirmación automática de citas | `confirmacion_automatica` | desactivada (valor inicial de todos los talleres) |
| Horario por día | tabla `horario_taller` | L–V 9–18, S 9–14 |

**Confirmación automática** — por defecto viene desactivada; al crear la cuenta, la app le muestra al taller que puede activarla.
- Activada: la cita en línea nace *confirmada*.
- Desactivada: nace *pendiente*; el taller la confirma (`confirmar_cita`) o la cancela. Si el cliente la reprograma, vuelve a *pendiente*.
- En los dos casos la cita aparta su cupo y su bahía desde que se crea, para que no haya sobrecupo mientras el taller la revisa.

### Aplicar en Supabase
1. En el panel de Supabase, abre **SQL Editor**.
2. Ejecuta, en orden, los archivos de `migrations/` y después `seed.sql`.
3. Regístrate en la app y ejecuta la consulta comentada al final de `seed.sql` (con tu correo) para quedar como dueño de MYRAC.
