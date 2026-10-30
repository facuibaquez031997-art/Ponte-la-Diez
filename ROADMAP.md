# Roadmap

Orden estricto: no se avanza de fase sin cerrar la anterior y sin verificación del programador antes de producción. Leyenda: ✅ hecho · 🔶 parcial · ⬜ pendiente.

## Fase 0: Inicialización

- ✅ Monorepo `apps/server` (NestJS) y `apps/client` (React + Vite); scaffolds viejos (`Back-end`, `custom-hook`) migrados
- ✅ Prisma 6 con `schema.prisma` del documento fuente; cliente generado
- ✅ Config de entorno validada, health check, build/lint/e2e pasando
- ✅ Engram y Gentle AI: contratos + implementación no-op
- 🔶 PostgreSQL: pendiente instalarlo (o usar Docker/Supabase) y poner `DATABASE_URL`
- ⬜ Integración real de Engram / Gentle AI (definir qué paquete o servicio se usa)

## Fase 1: Auth y usuarios (semanas 1-2)

- ⬜ Primera migración (`npm run db:migrate`)
- ⬜ Módulo `auth`: registro, login, bcrypt, JWT
- ⬜ `RolesGuard` (PLAYER / OWNER) y módulo `users`
- ⬜ Pantallas de Auth en el client según Stitch

## Fase 2: Canchas y turnos (semanas 3-4)

- ⬜ CRUD de canchas (OWNER)
- ⬜ Generación de turnos y disponibilidad
- ⬜ Búsqueda por barrio, superficie y precio

## Fase 3: Mercado Pago y reservas (semanas 5-6)

- ⬜ `/pagos/create-preference` y `/pagos/webhook`
- ⬜ Módulo `reservas` y UI del flujo de pago

## Fase 4: Falta Uno y Push (semana 7)

- ⬜ CRUD de convocatorias
- ⬜ `web-push` en el server y Service Worker (`public/sw.js`)

## Fase 5: Refinamiento y deploy (semana 8)

- ⬜ Revisión contra Stitch, e2e, optimización móvil
- ⬜ Deploy (Vercel/Render/Supabase), solo tras aprobación del programador
