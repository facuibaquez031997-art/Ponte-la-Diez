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
| 7 | 1 - Stitch | Rotar la API key de Stitch, que quedó expuesta en texto plano en el chat (dos veces) | ⏳ |
| 8 | 1 - Base de datos | Borrar el usuario de prueba `test.client@example.com` de la base de desarrollo | ⏳ |
| 9 | 1 - Base de datos | Borrar también el usuario de prueba `claude.test@example.com` de la base de desarrollo | ⏳ |
| 10 | 2 - Canchas | Reemplazar los datos de ejemplo de "Explorar canchas" (`exploreSampleData.ts`) por la API real de canchas, turnos y convocatorias | ⏳ |
| 11 | 2 - Canchas | El texto "Reserva protegida" (seña en custodia, cancelación gratuita hasta 4 h) viene del diseño de Stitch: definir la política real o quitarlo antes de publicar | ⏳ |
| 12 | 4 - Falta Uno | Límite de frecuencia para enviar avisos de "falta un jugador" y opción para que cada jugador silencie avisos (evitar spam al barrio) | ⏳ |
| 13 | 1 - Usuarios | Pasar `barrioPontevedra` de texto libre a una lista fija de barrios, para que coincidan los destinatarios de los avisos | ⏳ |
| 14 | 4 - Push | Bandeja de notificaciones dentro de la app como respaldo del push (permiso rechazado o iPhone sin instalar la app en la pantalla de inicio) | ⏳ |
| 15 | 2 - Fotos | Subida de fotos: validar tipo y tamaño en el servidor (no solo en el navegador), firmar las subidas a la nube, guardar las credenciales del proveedor solo en `.env` y definir cómo se moderan las fotos reportadas | ⏳ |

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
