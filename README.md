# 🏟️ Pontevedra Fútbol App (MVP)

Aplicación web para la gestión de reservas de canchas, pagos online y organización de partidos en Pontevedra.  
Este proyecto está desarrollado con **React + TypeScript + TailwindCSS + react-router-dom** en el frontend, y se integra con un backend en **Node.js/Express + PostgreSQL**.

---

## 🚀 Alcance del MVP

### Incluido en el MVP
- 💳 **Pasarela de Pagos (Mercado Pago API)**: Cobro de seña o reserva completa al confirmar turno.
- 🔔 **Notificaciones Push (Web Push API / Service Workers)**: Alertas cuando falta gente en un partido, alguien se suma a tu convocatoria o se confirma una reserva.
- 🏟️ **Gestión de Canchas y Turnos**: Publicación de canchas, horarios disponibles y reservas.
- 👥 **Módulo Social (Convocatorias “Falta Uno”)**: Organización de partidos y búsqueda de jugadores.

### Post-MVP (Fase 2)
- ❌ Módulo de Torneos, Fixtures y Tablas de Posiciones.

---

## 🗄️ Modelo de Datos (PostgreSQL)

Tablas principales:
- **Users**: id, nombre, email, password_hash, rol (jugador/dueño), telefono, barrio_pontevedra.
- **Canchas**: id, owner_id, nombre, direccion, tipo_superficie, precio_hora, monto_sena.
- **Turnos**: id, cancha_id, fecha_hora_inicio, fecha_hora_fin, estado (libre, reservado, bloqueado).
- **Reservas**: id, turno_id, user_id, estado (pendiente, confirmada, cancelada), monto_total.
- **Pagos**: id, reserva_id, mp_preference_id, mp_payment_id, estado_pago (pending, approved, rejected), monto.
- **Convocatorias_Partidos**: id, creador_id, cancha_id (opcional), fecha_hora, jugadores_faltantes, estado.
- **Push_Subscriptions**: id, user_id, endpoint, keys_p256dh, keys_auth.

---

## ⚙️ Arquitectura e Integraciones

- **Frontend**: React + TypeScript + TailwindCSS + react-router-dom.
- **Backend**: Node.js/Express o Next.js API Routes.
- **Base de Datos**: PostgreSQL (Prisma ORM).
- **Pagos**: Mercado Pago Checkout Pro + Webhooks.
- **Notificaciones**: Web Push API con librería `web-push`.

---

## 📅 Plan de Ejecución (Sprints)

1. **Fase 1: Base de Datos, Autenticación y Roles** (Semana 1-2)  
   - Configuración backend y DB.  
   - Registro/Login y control de roles.

2. **Fase 2: Gestión de Canchas y Turnos** (Semana 3-4)  
   - Panel para dueños.  
   - Búsqueda y filtrado de canchas.

3. **Fase 3: Pagos con Mercado Pago** (Semana 5-6)  
   - Integración de API y Webhooks.  
   - Confirmación automática de reservas.

4. **Fase 4: Módulo Social + Push API** (Semana 7)  
   - Convocatorias de partidos.  
   - Notificaciones en navegador/móvil.

5. **Fase 5: Testing y Despliegue** (Semana 8)  
   - Optimización mobile.  
   - Deploy en Vercel/Render/Supabase.

---

## 🛠️ Instalación y Uso

### Requisitos
- Node.js >= 18
- PostgreSQL >= 14
- Yarn o npm

### Pasos
```bash
# Clonar repositorio
git clone https://github.com/usuario/pontevedra-futbol-app.git
cd pontevedra-futbol-app

# Instalar dependencias
npm install

# Levantar frontend
npm run dev

https://www.figma.com/make/czrb6t3ffAcIK9gQkYSegq/Ponte-la-10-app?fullscreen=1&t=8VRNi7RmFBArlXIl-1&code-node-id=0-6