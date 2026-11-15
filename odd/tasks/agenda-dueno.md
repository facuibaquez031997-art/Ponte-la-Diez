Objective: the owner sees their whole agenda (every slot of every court, by day) in the dashboard and inside the chat, to answer a player's inquiry fast and not lose a slot.
Branch: feat/agenda-dueno (from feat/chat-por-reserva, because the chat panel uses it) · Delivery: ask-on-risk · Test runner: vitest (`npm test` in apps/server), client: `tsc -b` + eslint (no client test runner)

## Specs

- S1 Owner agenda, user words (L1): "en el dashboard del dueño tiene que tener la opcion de ver toda su agenda. por ejemplo acabo de preguntar desde el perfil de jugador por el chat si el dueño de la cancha tiene disponibles canchas para el dia 20/11/2026 y en el dashboard de el dueño no puedo fijarme eso." A page `/dueno/agenda` (link "Agenda" in the owner menu) shows, for a chosen day (default today, Argentina time), every slot of every court of the owner with its state: free, booked and paid (who, what was paid, what is left to collect at the court), booked and waiting for payment (and until when), or blocked. The day can be changed with previous/next day buttons and a date field.
- S2 Server `GET /agenda?fecha=AAAA-MM-DD` (OWNER only), assumption A1: it brings the slots of the day for the owner's courts only, after freeing the expired holds and bringing the slots in line with the weekly schedule (like the public availability does). The player is shown by name and photo only (no phone, no email: pending #26). Assumption A2: slots are generated 14 days ahead, so for a later day the answer says there are no slots generated yet (`fueraDeVentana`), instead of showing an empty day as if the court were closed.
- S3 Agenda inside the chat, user words (L1): "este punto es vital en el dashboard del dueño para que pueda contestar rapido y no perder un turno". In the owner's thread, a "Ver agenda" button opens the agenda of THAT court for a day, without leaving the chat; clicking a free slot writes a ready answer in the message box ("Tengo disponible el ... a las ... hs.") that the owner can edit and send. Assumption A3: the date starts today.
- S4 The agenda refreshes by itself every 30 seconds while open, so a new booking shows up without reloading.

## Tasks

- [ ] T1 S2 · inline · server: `GET /agenda` (service + controller + date helper) with tests · commit: -
- [ ] T2 S1 S4 · inline · client: service, hook, day view, page `/dueno/agenda`, menu link · commit: -
- [ ] T3 S3 · inline · client: agenda panel inside the owner's chat with the "answer with this slot" action · commit: -
- [ ] T4 · inline · live check against the real database, docs and pending list · commit: -

## Log

- L1 2026-11-15 user, verbatim, while reviewing the chat in the browser: "en el dashboard del dueño tiene que tener la opcion de ver toda su agenda. por ejemplo acabo de preguntar desde el perfil de jugador por el chat si el dueño de la cancha tiene disponibles canchas para el dia 20/11/2026 y en el dashboard de el dueño no puedo fijarme eso. 2- este punto es vital en el dashboard del dueño para que pueda contestar rapido y no perder un turno."
- 2026-11-15: the slots are generated on read (`TurnosService.sync`, window of 14 days), so the agenda must sync before reading. Blocking slots by hand is NOT part of this request: not built.
