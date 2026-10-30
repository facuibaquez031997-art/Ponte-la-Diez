# ⚽️ Ponte la 10

Aplicación web para reservar canchas de fútbol en Pontevedra (Buenos Aires, Argentina): turnos con seña o pago total por Mercado Pago, y convocatorias sociales "Falta Uno" con notificaciones push.

- Fuente de la verdad del proyecto: [`CLAUDE.md`](./CLAUDE.md)
- Arquitectura y decisiones técnicas: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Estado y plan de fases: [`ROADMAP.md`](./ROADMAP.md)
- Diseño: Stitch `18292400609503454593` (principal) y [Figma](https://www.figma.com/make/czrb6t3ffAcIK9gQkYSegq/Ponte-la-10-app?fullscreen=1&t=8VRNi7RmFBArlXIl-1&code-node-id=0-6) (complementario)

## Alcance del MVP

- Registro/login con roles `PLAYER` y `OWNER`.
- Gestión de canchas y turnos (disponibilidad, bloqueo).
- Reservas con pago por Mercado Pago (Checkout Pro + webhooks).
- Convocatorias "Falta Uno" y notificaciones Web Push.

Fuera del MVP: torneos, fixtures y tablas de posiciones.

## Stack

| Capa | Tecnología |
| --- | --- |
| Backend | NestJS (adaptador Express), Prisma 6, PostgreSQL |
| Frontend | React, Vite, TypeScript, TailwindCSS, react-router-dom, Axios |
| Pagos | Mercado Pago |
| Push | `web-push` + Service Worker |

## Estructura

```
apps/server   API NestJS + Prisma (prisma/schema.prisma)
apps/client   SPA React + Vite
```

## Puesta en marcha

Requisitos: Node.js >= 22, npm >= 10 y PostgreSQL >= 14.

```bash
npm install --legacy-peer-deps      # instala ambos workspaces desde la raíz
cp apps/server/.env.example apps/server/.env   # y completar DATABASE_URL
cp apps/client/.env.example apps/client/.env

npm run db:generate                 # genera el cliente Prisma
npm run db:migrate                  # aplica migraciones (requiere PostgreSQL en marcha)

npm run dev:server                  # API en http://localhost:3000/api
npm run dev:client                  # SPA en http://localhost:5173
```

Comprobación rápida: `GET http://localhost:3000/api/health` devuelve el estado de la API y de la base.

`--legacy-peer-deps` es necesario: `npm install` a secas falla con un bug de npm (`edgesOut`) sobre este workspace.

## Scripts (raíz)

| Script | Qué hace |
| --- | --- |
| `npm run build` | Compila server y client |
| `npm run lint` | Lint de ambos |
| `npm test` | Tests del server |
| `npm run db:generate` / `db:migrate` | Prisma |

Los commits siguen Conventional Commits (commitlint + husky en la raíz).
