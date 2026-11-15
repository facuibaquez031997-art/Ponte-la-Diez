Objective: player <-> owner chat, designed in `docs/chat-por-reserva.md` (read it: it is the detailed design), so the player can talk to the court owner to settle the slot.
Branch: feat/chat-por-reserva (from feat/pagos-mercadopago, because it needs `Reserva`) · Delivery: ask-on-risk · Test runner: vitest (`npm test` in apps/server), client: `tsc -b` + eslint (no client test runner)

## Specs

- S1 Origin, user words (L1): "que el usuario tenga la posibilidad de enviar un mensaje, de poder comunicarse con el dueño de cancha seria bueno para terminar de eleguir el horario concretamente". v1 is player <-> owner only.
- S2 Only the player starts a conversation, with or without a booking, user words (L2): "solo el jugador puede iniciar la conversacion". The owner never starts one: the owner only answers conversations the player opened. A conversation has a player, a court and an optional booking (`reservaId`, `turnoInicio` optional).
- S3 Only the two participants (the player and the court's owner) read or write; anyone else gets 404, not 403.
- S4 Deleting a chat is individual, user words (L3): "el eliminar el chat ya sea el dueño o el jugador solo se elimina para quien decida eliminarlo". It only hides it from that person's inbox (`jugadorEliminoAt` / `duenoEliminoAt`); the other keeps the thread intact.
- S5 Hidden chat that gets a new message, user words (L4): "si no se elimino nada tiene que aparecer con todo el historial, si se elimino el chat debe aparecer con los mensajes posteriores a la eliminacion". Rule: never deleted -> whole history; deleted -> only messages with `createdAt > eliminoAt`; the chat is hidden while `ultimoMensajeAt <= eliminoAt`.
- S6 If the booking is released (unpaid after 15 minutes, pagos A1/A2) the conversation survives: `reservaId` becomes null and the banner says "El turno volvió a quedar libre".
- S7 Messages are kept while the court exists; when a court is deleted its threads go with it (a court with paid bookings is kept in the history, commit 95f4a37, and so are its threads).
- S8 Text only, 1000 characters maximum, and a per-user limit of messages per minute with a clear error; no attachments, audio or automatic phone sharing.
- S9 Unread counts per side (`jugadorLeyoHasta` / `duenoLeyoHasta`) and one single unread notification per conversation: later messages update it instead of creating another one (+ push).
- S10 Client: route `/mensajes` (list on the left, thread on the right, Stitch "Mensajes & Chat"); entry points: "Consultar al dueño" in the court card, "Hablar con el dueño" in each "Mis reservas" card, "Responder" in each owner booking row, and the "Mensajes" menu link (today `#`). Polling: 5 s while a thread is open, 30 s for the bell. Stitch reference is checked before building any UI.

## Tasks

- [x] T1 S2 S3 S4 S6 S7 · inline · Prisma `Conversacion` + `Mensaje` (index `[conversacionId, createdAt]`) and migration · commit: 8ef350c
- [x] T2 S2 S3 S4 S5 S6 S8 · inline · server module `conversaciones`: create, list (unread, hidden rule), thread (paginated), send (limit), mark read, delete-for-me · commit: dc90007 (18 tests; suite 345 green)
- [x] T3 S9 · inline · notification to the other participant, one unread per conversation, + push · commit: dcbded2 (10 tests; suite 355 green). Assumption A1: the push goes out only when the notification is created, not on every message of a burst.
- [ ] T4 S10 · inline · client: service, `/mensajes` page, thread, polling · commit: -
- [ ] T5 S10 · inline · client entry points (court card, my bookings, owner bookings, menu) · commit: -
- [ ] T6 · inline · docs, pending list update, close · commit: -

## Log

- L1 2026-11-15 user, verbatim: "que el usuario tenga la posibilidad de enviar un mensaje, de poder comunicarse con el dueño de cancha seria bueno para terminar de eleguir el horario concretamente" and "dejemos lo del chat con el dueño aparte diseñandolo ya colgado en la reserva". Later, "arranca con la implementacion".
- L2 2026-11-15 user, verbatim: "solo el jugador puede iniciar la conversacion, una vez que la conversacion este comenzada como el chat va a quedar (si es que el dueño no la elimina que puede tener la opcion de eliminar el chat)".
- L3 2026-11-15 user, verbatim: "cuando el dueño elimine su chat que se oculte solo en su bandeja. y lo mismo para el jugador, si quiere eliminar el chat que lo elimine y no se elimine para el dueño en ese caso. osea el eliminar el chat ya sea el dueño o el jugador solo se elimina para quien decida eliminarlo."
- L4 2026-11-15 user, verbatim: "si no se elimino nada tiene que aparecer con todo el historial, si se elimino el chat debe aparecer con los mensajes posteriores a la eliminacion". And on retention: "si esa regla sirve" (S7).
- 2026-11-15: branch cut from feat/pagos-mercadopago (main does not have `Reserva` yet: the payments chain is not merged).
