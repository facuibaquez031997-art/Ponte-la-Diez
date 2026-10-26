⚽️ Ponte la 10 App - Fuente de la Verdad (CLAUDE.md)

Este documento es la fuente de la verdad principal para Claude Code durante la ejecución, arquitectura y mantenimiento del proyecto Ponte la 10. Toda instrucción, modificación de archivos y creación de código debe alinearse estrictamente con lo especificado aquí.

📌 Contexto General del Proyecto

Nombre de la App: Ponte la 10 ⚽️

Ubicación Objetivo: Pontevedra, Provincia de Buenos Aires, Argentina.

Propósito: Aplicación web MVP para reserva de canchas de fútbol, gestión de turnos con seña/pago total mediante Mercado Pago, e interacción social a través del módulo de convocatorias "Falta Uno" con notificaciones Push.

Fuentes de Diseño:

Stitch Project ID: 18292400609503454593 (Base visual y UI/UX primaria).

Figma URL: Modelo conceptual complementario.

Screens ID: 81d58302881d4590a5e449b84f45a529, eaf537bda07c4840a74b7b429b800dd9, 52df8f63d9064a2c9adadac38f75950c, 3190b3e15a324bf0a26cbbeca31f1dc0, e62e6e42a85f4b00ab5d7a7b8b0f6b6b, aa47aecfd8b04b6e897cc9ada7d4170f, c3525717c10048a3b819b4a26fb0a972, 07268e7bc2ee4abe871f62f911c7f4d1.

🛠️ Stack Tecnológico Definitivo

Backend: NestJS (Node.js/TypeScript) + Express Adapter + Prisma ORM.

Base de Datos: PostgreSQL.

Frontend: React + Vite + TypeScript + TailwindCSS + react-router-dom.

Pagos: Mercado Pago API (Checkout Pro + Webhooks).

Notificaciones: Web Push API (web-push en backend / Service Worker en frontend).

Herramientas de IA y Memoria (No instaladas aún, requeridas en flujo):

Engram: Sistema de persistencia de contexto / memoria para el asistente de IA.

Gentle AI: Framework/Orquestador para automatización de flujos inteligentes y agentes dentro de la aplicación.

📂 Arquitectura y Estructura de Carpetas

El proyecto adoptará una estructura monorepo o proyecto unificado backend/frontend para facilitar la cohesión en el desarrollo.

ponte-la-10/
├── CLAUDE.md                        # Este documento (Fuente de la Verdad)
├── package.json                     # Scripts globales del workspace
├── docs/                            # Documentación de diseño, API y diagramas
│   └── architecture.md
│
├── apps/ (o carpetas raíz /client y /server)
│   ├── server/                      # BACKEND (NestJS)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Modelo de datos PostgreSQL
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── main.ts              # Entry point NestJS
│   │   │   ├── app.module.ts        # Módulo raíz
│   │   │   ├── common/              # Guards, Interceptors, Filters, DTOs compartidos
│   │   │   ├── config/              # Variables de entorno (Env config)
│   │   │   ├── engram/              # Adaptador e integración con Engram AI Context
│   │   │   ├── gentle-ai/           # Módulo para agentes e inteligencia de Gentle AI
│   │   │   ├── modules/
│   │   │   │   ├── auth/            # JWT, Login, Registro, Roles (PLAYER / OWNER)
│   │   │   │   ├── users/           # Perfiles de usuario y gestión de barrios
│   │   │   │   ├── canchas/         # Complejos, canchas, superficies y precios
│   │   │   │   ├── turnos/          # Generación, disponibilidad y bloqueo de horarios
│   │   │   │   ├── reservas/        # Creación y estado de reservas
│   │   │   │   ├── pagos/           # Mercado Pago API & Webhook handler
│   │   │   │   ├── convocatorias/   # Módulo social "Falta Uno"
│   │   │   │   └── notifications/   # Push Notifications (web-push)
│   │   └── test/                    # Tests Unitarios e Integración (Jest)
│   │
│   └── client/                      # FRONTEND (React + Vite + TailwindCSS)
│       ├── public/
│       │   ├── sw.js                # Service Worker para Push Notifications
│       │   └── icons/
│       ├── src/
│       │   ├── assets/              # Imágenes, fuentes, estilos de Stitch
│       │   ├── components/          # Componentes de UI reutilizables
│       │   │   ├── common/          # Buttons, Cards, Inputs, Modals
│       │   │   ├── layout/          # Header, BottomNav, Sidebar
│       │   │   └── stitch/          # Componentes migrados directamente de Stitch UI
│       │   ├── context/             # AuthContext, NotificationContext
│       │   ├── hooks/               # Custom React Hooks
│       │   ├── pages/               # Vistas principales (Router)
│       │   │   ├── Auth/            # Login / Registro
│       │   │   ├── Home/            # Dashboard Principal
│       │   │   ├── Canchas/         # Buscador y Detalle de Cancha
│       │   │   ├── Reservas/        # Selección de Turno y Pago
│       │   │   ├── Convocatorias/   # Módulo "Falta Uno"
│       │   │   └── Owner/           # Panel del Dueño de Cancha
│       │   ├── services/            # Clientes API Axios / Fetch
│       │   ├── styles/              # Configuración TailwindCSS
│       │   ├── App.tsx
│       │   └── main.tsx


🗄️ Modelo de Datos (Prisma Schema Reference)

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  PLAYER
  OWNER
}

enum TurnoState {
  FREE
  RESERVED
  BLOCKED
}

enum ReservaState {
  PENDING
  CONFIRMED
  CANCELLED
}

enum PaymentState {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id               String             @id @default(uuid())
  nombre           String
  email            String             @unique
  passwordHash     String
  rol              Role               @default(PLAYER)
  telefono         String?
  barrioPontevedra String?
  createdAt        DateTime           @default(now())
  canchas          Cancha[]           @relation("OwnerCanchas")
  reservas         Reserva[]
  convocatorias    Convocatoria[]
  subscriptions    PushSubscription[]
}

model Cancha {
  id             String         @id @default(uuid())
  ownerId        String
  owner          User           @relation("OwnerCanchas", fields: [ownerId], references: [id])
  nombre         String
  direccion      String
  tipoSuperficie String
  precioHora     Float
  montoSena      Float
  turnos         Turno[]
  convocatorias  Convocatoria[]
}

model Turno {
  id              String     @id @default(uuid())
  canchaId        String
  cancha          Cancha     @relation(fields: [canchaId], references: [id])
  fechaHoraInicio DateTime
  fechaHoraFin    DateTime
  estado          TurnoState @default(FREE)
  reserva         Reserva?
}

model Reserva {
  id         String       @id @default(uuid())
  turnoId    String       @unique
  turno      Turno        @relation(fields: [turnoId], references: [id])
  userId     String
  user       User         @relation(fields: [userId], references: [id])
  estado     ReservaState @default(PENDING)
  montoTotal Float
  pago       Pago?
}

model Pago {
  id             String       @id @default(uuid())
  reservaId      String       @unique
  reserva        Reserva      @relation(fields: [reservaId], references: [id])
  mpPreferenceId String?
  mpPaymentId    String?
  estadoPago     PaymentState @default(PENDING)
  monto          Float
}

model Convocatoria {
  id                 String   @id @default(uuid())
  creadorId          String
  creador            User     @relation(fields: [creadorId], references: [id])
  canchaId           String?
  cancha             Cancha?  @relation(fields: [canchaId], references: [id])
  fechaHora          DateTime
  jugadoresFaltantes Int
  estado             String   @default("ABIERTA")
}

model PushSubscription {
  id        String @id @default(uuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id])
  endpoint  String
  keysP256  String
  keysAuth  String
}


🔄 Flujo de Desarrollo Paso a Paso (Roadmap)

Claude Code debe seguir estrictamente este orden secuencial para el desarrollo:

Fase 0: Inicialización e Integración de IA Avanzada

Configurar estructura base de carpetas (/server con NestJS y /client con React+Vite).

Instalación y configuración de Prisma ORM con PostgreSQL.

Instalación y Configuración de Engram & Gentle AI:

Instalar y configurar Engram para mantener la persistencia de contexto del proyecto en el backend.

Instalar e integrar Gentle AI para la gestión proactiva de tareas automatizadas o lógica asistida dentro del ecosistema de la app.

Fase 1: Base de Datos, Autenticación y Módulo de Usuarios (Semana 1-2)

Ejecutar migraciones iniciales de Prisma (npx prisma migrate dev).

Implementar módulo auth en NestJS (Registro, Login, Hashing con bcrypt, Tokens JWT).

Implementar RolesGuard para restringir accesos a PLAYER y OWNER.

Conectar frontend con las pantallas de Auth adaptadas del diseño de Stitch.

Fase 2: Gestión de Canchas y Turnos (Semana 3-4)

CRUD de Canchas para el rol OWNER.

Motor de disponibilidad de Turnos (generación automática de slots según horarios).

Búsqueda y filtrado de canchas en el frontend por barrio de Pontevedra, tipo de superficie y precio.

Fase 3: Integración de Pagos con Mercado Pago (Semana 5-6)

Crear módulo pagos en NestJS usando el SDK de Mercado Pago.

Endpoint para crear Preferencias de Pago (/pagos/create-preference).

Endpoint de Webhook (/pagos/webhook) para procesar IPN (Instant Payment Notification) y confirmar reservas de forma automática.

UI del flujo de pago en frontend.

Fase 4: Módulo Social "Falta Uno" + Push API (Semana 7)

CRUD de Convocatoria para búsqueda de jugadores faltantes.

Integración de web-push en NestJS para suscribir usuarios a notificaciones.

Service Worker en el frontend para recepción de alertas en móvil/navegador.

Fase 5: Refinamiento UI/UX (Stitch) y Despliegue (Semana 8)

Inspección final contra componentes del prototipo Stitch ID 18292400609503454593.

Pruebas e2e y optimización móvil.

Despliegue en producción (Vercel/Render/Supabase).

⚠️ Reglas de Conducta para Claude Code

No modificar la base de datos sin actualizar schema.prisma primero.

Respetar estrictamente el diseño de Stitch: Antes de crear un componente UI, verificar la referencia visual de Stitch/Figma indicada en este documento.

TypeScript Estricto: Evitar el uso de any. Definir DTOs en NestJS e Interfaces/Types en React.

Respuesta Modular: Cada vez que desarrolles una tarea, crea o edita exclusivamente los archivos pertenecientes al módulo actual del flujo.