# 📋 Pendientes y recomendaciones previas al despliegue

Registro numerado de recomendaciones hechas durante el desarrollo. **Antes de cualquier despliegue a producción, Claude debe recordarle al programador revisar esta lista, y al finalizar el proyecto debe recordarle presentarla a su jefe.**

Estados: ⏳ Pendiente · ✅ Resuelto · ➖ Aceptado como está (anotar motivo)

| # | Fase | Recomendación | Estado |
|---|------|---------------|--------|
| 1 | 1 - Auth | Registro público permite elegirse rol `OWNER` sin verificación | ⏳ |
| 2 | 1 - Base de datos | Rotar la contraseña de PostgreSQL y limpiar el `.env` | ⏳ |
| 3 | 1 - Auth | Usar un `JWT_SECRET` distinto en producción | ⏳ |
| 4 | 1 - Auth | Agregar límite de intentos (rate limiting) a login y registro | ⏳ |
| 5 | 1 - Dependencias | Revisar `npm audit` y corregir vulnerabilidades | ⏳ |
| 6 | 1 - Tests | Corregir el error de tipos `supertest/types` en `test/app.e2e-spec.ts` | ⏳ |
| 7 | 1 - Stitch | Rotar la API key de Stitch, que quedó expuesta en texto plano en el chat (dos veces) | ✅ |
| 8 | 1 - Base de datos | Borrar el usuario de prueba `test.client@example.com` de la base de desarrollo | ✅ |
| 9 | 1 - Base de datos | Borrar también el usuario de prueba `claude.test@example.com` de la base de desarrollo | ✅ |
| 10 | 2 - Canchas | En "Explorar canchas" las canchas y turnos ya vienen de la API; siguen siendo datos de ejemplo (`exploreSampleData.ts`) los bloques "Partidos abiertos" y "Próxima fecha confirmada": conectarlos a las convocatorias y a las reservas reales (Fase 3) o quitarlos antes de publicar | ⏳ |
| 11 | 2 - Canchas | El texto "Reserva protegida" (seña en custodia, cancelación gratuita hasta 4 h) viene del diseño de Stitch: definir la política real o quitarlo antes de publicar | ⏳ |
| 12 | 4 - Falta Uno | Límite de frecuencia para enviar avisos de "falta un jugador" y opción para que cada jugador silencie avisos (evitar spam al barrio) | ⏳ |
| 13 | 1 - Usuarios | Pasar `barrioPontevedra` de texto libre a una lista fija de barrios, para que coincidan los destinatarios de los avisos | ✅ |
| 14 | 4 - Push | Bandeja de notificaciones dentro de la app como respaldo del push (permiso rechazado o iPhone sin instalar la app en la pantalla de inicio) | ✅ |
| 15 | 2 - Fotos | Subida de fotos: validar tipo y tamaño en el servidor (no solo en el navegador), firmar las subidas a la nube, guardar las credenciales del proveedor solo en `.env` y definir cómo se moderan las fotos reportadas | ⏳ |
| 16 | 1 - Base de datos | Borrar el usuario de prueba `t1.check.1793828121@example.com` creado al probar el perfil (T1) | ✅ |
| 17 | 4 - Falta Uno | Borrar los 4 usuarios de prueba `t3.{a,b,c,d}.1793828679@example.com` y la convocatoria de prueba creada al probar T3 | ✅ |
| 18 | 4 - Push | El servidor envía el push al `endpoint` que manda el cliente (solo se exige `https`): restringir a los hosts de los servicios push reales (FCM, Mozilla, Apple, Windows) para evitar que se use como proxy hacia URLs arbitrarias (SSRF) | ⏳ |
| 19 | 4 - Push | Generar claves VAPID propias para producción (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) y cargarlas como variables del hosting; no reutilizar las de desarrollo | ⏳ |
| 20 | 4 - Push | El aviso a un barrio grande se envía con `Promise.all` sin límite de concurrencia: procesar en lotes o con una cola antes de que haya muchos usuarios por barrio | ⏳ |
| 21 | 4 - Push | Borrar los usuarios de prueba `t4.{a,b,c}.1793830377@example.com`, `t4b.{a,b}.1793830698@example.com` y `t4c.{a,b}.1793831356@example.com` y sus convocatorias y notificaciones de la base de desarrollo | ✅ |
| 22 | 2 - Canchas | En el formulario "Falta uno" la cancha es texto libre (`Convocatoria.canchaNombre`): cuando exista el CRUD de canchas, reemplazarla por un selector que guarde `canchaId` y migrar o descartar `canchaNombre` | ⏳ |
| 23 | 4 - Falta Uno | Borrar los usuarios de prueba `t6.{c,a,b,d,f,e}.1794099785371@example.com` y su convocatoria, respuestas y notificaciones de la base de desarrollo | ✅ |
| 24 | 4 - Contactos | Borrar los usuarios de prueba `t8.{u1,u2,u3,u4}.1794102346117@example.com` y `t8.{u1,u2,u3,u4}.1794102293426@example.com`, sus contactos, avisos, respuestas y notificaciones de la base de desarrollo | ✅ |
| 25 | 4 - Contactos | Límite de frecuencia para enviar solicitudes de contacto (evitar que alguien las dispare en masa a emails que adivina o recolecta) y opción de bloquear a un jugador; hoy una solicitud rechazada se puede volver a enviar sin límite | ⏳ |
| 26 | 4 - Contactos | La búsqueda por nombre muestra nombre, foto y barrio de cualquier jugador a cualquier jugador registrado: definir qué dato se comparte, agregar una opción de privacidad (por ejemplo "no aparecer en búsquedas") y combinarla con el límite de frecuencia del #25 antes de abrir el registro al público | ⏳ |
| 27 | 4 - Contactos | Borrar los usuarios de prueba `t12.{a,b,c,o}.1794103586549@example.com` y `t12.{a,b,c,o}.1794103644308@example.com` (el `o` es un `OWNER`), y sus solicitudes y notificaciones, de la base de desarrollo | ✅ |
| 28 | 2 - Turnos | La generación de turnos (`TurnosService.sync`) lee y después escribe sin ser atómica: si el dueño guarda una agenda nueva justo mientras un jugador consulta disponibilidad, puede quedar por un instante un turno libre que la agenda ya no incluye (converge en la siguiente consulta o guardado). Evaluar un bloqueo por cancha (advisory lock) cuando haya muchos usuarios | ⏳ |
| 29 | 2 - Turnos | El filtro `fecha` de `GET /canchas/:id/turnos` acepta años menores a 0100 (por ejemplo `0050-01-01`) y devuelve lista vacía en vez de 400; es cosmético, pero conviene validar un rango de años razonable | ⏳ |
| 30 | 3 - Reservas | Una reserva sin pagar libera el turno a los 15 minutos (`HOLD_MS`). Si un jugador paga en Mercado Pago justo después de que venza, el pago aprobado llega con el turno ya liberado y quizás tomado por otro: definir qué pasa (reembolso automático o aviso al dueño) y si 15 minutos es el tiempo correcto para el negocio | ⏳ |
| 31 | 3 - Reservas | Las reservas vencidas se liberan al consultar disponibilidad, al reservar o al abrir "Mis reservas" (no hay tarea programada). Si una cancha no se consulta, su turno vencido sigue oculto hasta la próxima consulta; evaluar un cron o una cola cuando haya tráfico real | ⏳ |
| 32 | 3 - Pagos | Antes de publicar: usar el `MP_ACCESS_TOKEN` de producción (hoy el de desarrollo), cargar `MP_WEBHOOK_SECRET`, `MP_NOTIFICATION_URL` (https público de `/api/pagos/webhook`) y `CLIENT_URL` con https como variables del hosting; con `CLIENT_URL` https se activa el regreso automático desde Mercado Pago (verificado: Mercado Pago descarta en silencio las `back_urls` que no son https, así que en desarrollo local el jugador no vuelve solo a `/reservas/resultado`; la pantalla se probó a mano y hay que revisar el regreso real en el primer despliegue). Además, cada pedido de pago crea una preferencia nueva (la anterior queda sin uso hasta que vence): guardar el link si se quiere reusar | ⏳ |
| 33 | 3 - Chat | Cuando se construya el chat con el dueño (diseño en `docs/chat-por-reserva.md`): largo máximo y límite de mensajes por minuto, una sola notificación sin leer por conversación, y definir moderación (reportar y bloquear) y cuánto tiempo se guardan los mensajes; se relaciona con #12, #25 y #26 | ⏳ |
| 34 | 3 - Reservas | Hasta que exista el chat, el dueño ve nombre y foto del jugador pero no tiene cómo comunicarse con él (no se muestran teléfono ni email a propósito, por privacidad): si un turno tiene un problema solo puede esperar al jugador en la cancha | ⏳ |
| 35 | 3 - Pagos | **Adónde va la plata:** todos los pagos entran hoy a la única cuenta de Mercado Pago del `MP_ACCESS_TOKEN` configurado (la de la plataforma). El dueño no recibe el dinero por la app y no puede devolverlo desde Mercado Pago: la devolución que hace el dueño es por fuera y la app solo la anota. Definir antes de publicar el modelo de cobro: Marketplace de Mercado Pago (cada dueño vincula su cuenta y la plataforma cobra una comisión, como sugiere la pantalla "Cuenta Mercado Pago vinculada" de Stitch) o liquidación manual al dueño. Es un tema para repasar con tu jefe | ⏳ |
| 36 | 3 - Reservas | Cuando el dueño cancela un turno pagado, la devolución al jugador es manual (el dueño avisa por fuera y marca "devolución hecha"): la app no mueve plata ni verifica que se haya devuelto. Cuando se defina el cobro (#35) evaluar devolver desde la API de Mercado Pago (reembolso total o parcial) y la política de cancelación (#11) | ⏳ |

---

## Detalle

### 1. Registro de dueños (`OWNER`) sin verificación
- **Situación:** `POST /api/auth/register` acepta `rol: "OWNER"` de cualquiera. Razonable para el MVP.
- **Riesgo:** cualquier persona puede crearse como dueño de cancha y publicar canchas.
- **Recomendación:** que el registro público solo cree `PLAYER` y que el rol `OWNER` lo apruebe un administrador (o se asigne por solicitud/verificación del complejo).
- **Archivos:** `apps/server/src/modules/auth/dto/register.dto.ts`, `auth.service.ts`.

### 2. Contraseña de PostgreSQL
- **Situación:** la contraseña está duplicada en `DB_PASSWORD` y dentro de `DATABASE_URL`, y quedó expuesta en texto plano en una sesión de trabajo.
- **Recomendación:** cambiarla antes del despliegue, dejar solo `DATABASE_URL` (Prisma no usa las variables `DB_*`) y usar un gestor de secretos del hosting.

### 3. `JWT_SECRET`
- **Situación:** el valor de desarrollo está en `apps/server/.env` (no versionado).
- **Recomendación:** generar un secreto nuevo para producción y cargarlo como variable de entorno del hosting. Nunca reutilizar el de desarrollo.

### 4. Rate limiting
- **Situación:** login y registro no limitan intentos.
- **Recomendación:** agregar `@nestjs/throttler` (o similar) para frenar fuerza bruta y registros masivos.

### 5. Vulnerabilidades de dependencias
- **Situación:** `npm install` reportó vulnerabilidades en `npm audit`; no se revisaron.
- **Recomendación:** correr `npm audit`, evaluar cada una y actualizar sin usar `--force` a ciegas.

### 6. Error de tipos en tests
- **Situación:** `tsc --noEmit` falla por `supertest/types` en `test/app.e2e-spec.ts`. Es previo al módulo auth y no afecta la ejecución de los tests.
- **Recomendación:** corregir el import para que el chequeo de tipos quede limpio en CI.
