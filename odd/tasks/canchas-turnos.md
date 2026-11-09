Objective: Fase 2 - courts CRUD for OWNER, per-court weekly schedule chosen by the owner, automatic slot (Turno) generation, player search by barrio/surface/price.
Branch: feat/canchas-turnos · Delivery: ask-on-risk · Test runner: vitest (`npm test` in apps/server), client: `tsc -b` + eslint (no client test runner)

## Specs

- S1 Owner courts CRUD: an OWNER creates, lists, edits and deletes only their own courts (`@Roles('OWNER')`; another owner's court answers 404/403). Fields from the schema: nombre, direccion, tipoSuperficie, precioHora, montoSena. Assumption A1: add `barrio` (from the fixed barrio list) so players can filter by barrio.
- S2 Players (any logged-in user) can list courts and read one court's detail.
- S3 Per-court weekly schedule, user's words: "el dueño de cancha debe poder manejar los horarios que el quiera" and "elegir el dia y horarios que cada dia les convenga y ir arreglando sus agendas de esa manera". Example 1: "el dueño de la cancha del mate tal ves maneje unos horarios de 15:00 a 00:00". Example 2: "el dueño de la cancha de el sol tenga horarios de 17:00 a 20:00". So each court has its own days and its own opening range per day, independent from other courts and from other days. Assumption A2: a day may have several ranges (no overlap); a range ends at most at 24:00 ("00:00" in the example means midnight), no range crosses midnight.
- S4 The owner can change the schedule at any time. Assumption A3: changing it never touches a Turno that is RESERVED or BLOCKED; FREE future slots outside the new schedule are removed, missing ones are created.
- S5 Slots are generated automatically from the schedule ("generación automática de slots según horarios", roadmap). Assumption A4: 1-hour slots, timezone America/Argentina/Buenos_Aires (UTC-3, no DST), rolling window of 14 days, generation is idempotent (no duplicate slot; needs `@@unique([canchaId, fechaHoraInicio])`).
- S6 Availability: players read the FREE future slots of a court by date.
- S7 Search: "Búsqueda y filtrado de canchas en el frontend por barrio de Pontevedra, tipo de superficie y precio" (roadmap), replacing `exploreSampleData.ts` (pending #10).
- Not included (not requested): owner manual block/unblock of a single slot, booking and payment (Fase 3).

## Tasks

- [ ] T1 (S1, S2) Server: `canchas` module, CRUD for OWNER + public list/detail, schema `Cancha.barrio` · route: inline
- [ ] T2 (S3, S4) Server: `HorarioCancha` model and `PUT/GET /canchas/:id/horarios` with overlap and range validation · route: inline
- [ ] T3 (S4, S5, S6) Server: slot generation from the schedule (idempotent, prune FREE on change), `GET /canchas/:id/turnos?fecha=` · route: inline
- [ ] T4 (S1, S3, S4) Client: owner panel (my courts, court form, weekly schedule editor per day with ranges) · route: inline
- [ ] T5 (S2, S6, S7) Client: replace sample data in "Explorar canchas" with the API, filters barrio/surface/price, free slots · route: inline

## Log

- L1 2026-11-09 user: "1- hagamos la grilla con la opcion A. pero dejo aclarado que el dueño de cancha debe poder manejar los horarios que el quiera. por ejemplo el dueño de la cancha del mate tal ves maneje unos horarios de 15:00 a 00:00 y el dueño de la cancha de el sol tenga horarios de 17:00 a 20:00 por lo tanto lo ideal es que ellos puedan elegir el dia y horarios que cada dia les convenga y ir arreglando sus agendas de esa manera."
- 2026-11-09: previous feature perfil-falta-uno verified in the browser; this one starts from its branch. Existing: global `JwtAuthGuard` + `RolesGuard`, `@Roles`, `@CurrentUser`; no canchas/turnos modules yet; models Cancha/Turno/Reserva/Pago exist in the schema.
