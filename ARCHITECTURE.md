# Arquitectura

Monorepo con npm workspaces (`apps/*`). Reglas de código en [`CLAUDE.md`](./CLAUDE.md).

## Backend: `apps/server`

NestJS 12 (ESM, imports con extensión `.js`), prefijo global `/api`, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`). Tests con Vitest, lint con oxlint.

```
src/
├── main.ts / app.module.ts
├── config/        validación de variables de entorno (class-validator)
├── common/
│   ├── prisma/    PrismaService + PrismaModule (global)
│   └── health/    GET /api/health
├── engram/        contrato EngramClient + implementación no-op
├── gentle-ai/     contrato GentleAiOrchestrator + implementación no-op
└── modules/       auth, users, canchas, turnos, reservas, pagos, convocatorias, notifications
```

Cada módulo de dominio sigue **Controller → Service → Repository** (Prisma solo dentro del repository) y define DTOs con class-validator.

### Decisiones

- **Prisma 6, no 7**: el schema de CLAUDE.md usa `url = env("DATABASE_URL")` dentro del datasource, que Prisma 7 ya no admite. Se fija `prisma@6`.
- **Engram y Gentle AI**: son herramientas de desarrollo y no hay un paquete npm de integración especificado. Se definió solo el contrato (token de inyección + interfaz) con implementación no-op, sin instalar dependencias. Reemplazar el provider cuando se defina la integración real.
- **Modelo de datos**: `prisma/schema.prisma` es idéntico al de CLAUDE.md. Cualquier cambio de BD empieza ahí.

## Frontend: `apps/client`

React 19 + Vite + Tailwind 4. `services/api.ts` es el cliente Axios (`VITE_API_URL`).

```
src/
├── components/{common,layout,stitch}
├── context/  hooks/  services/  styles/
└── pages/{Auth,Home,Canchas,Reservas,Convocatorias,Owner}
```

Los componentes de UI se contrastan con el prototipo Stitch antes de crearse.

## Herramientas del repo

Husky, commitlint, lint-staged y Prettier viven en la raíz (necesitan `.git`).

## Entorno de desarrollo

- Windows 11, Node 22.
- Sin PostgreSQL ni Docker instalados todavía: el health check informa `database: "down"` hasta que haya una base.
