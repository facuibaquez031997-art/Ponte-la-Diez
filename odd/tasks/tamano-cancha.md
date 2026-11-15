Objective: every court has a size (5, 7, 9 or 11 players), shown everywhere a court is shown, filterable by the player, and the owner can offer from the chat a slot of any of their courts according to its size.
Branch: feat/tamano-cancha (from feat/chat-reservar-presencia, because the offer is made from the chat) · Delivery: ask-on-risk · Test runner: vitest (`npm test` in apps/server), client: `tsc -b` + eslint (no client test runner)

## Specs

- S1 Court size, user words (L1): "tiene que exitir la opcion de la cancha que se va a reservar de cuanto es: 5 jugadores, de 7 jugadores, de 9 jugadores o de 11 jugadores. ya que cada dueño tiene diferentes tamaños de canchas y se pueden ofrecer segun los tamaños de las canchas." A court has `jugadores`, one of 5, 7, 9, 11. The owner chooses it when creating a court (required) and can change it when editing. Assumption A1: courts that already exist have no size yet (`null`, not a made-up 5): they show without a size until the owner sets it, and the owner's list says so.
- S2 The size is shown wherever the court is shown, as "N jugadores": the card of "Explorar canchas", the owner's court cards, the booking dialog, the agenda (each court of the day), the offer card inside the chat and the chat header. A court without size shows nothing about it.
- S3 The player can filter "Explorar canchas" by size (any, or one of the four), next to the existing filters (barrio, superficie, precio). Assumption A2: the filter is exact (a 7 shows only 7).
- S4 Offer according to the size, user words (L1): "se pueden ofrecer segun los tamaños de las canchas". Assumption A3: from the chat, the owner can offer a free slot of ANY of their courts (not only the one the player asked about), so an inquiry about a 5 can be answered with a 7. The agenda panel inside the chat shows all the courts of the owner, each with its size, the court of the conversation first. The offer keeps the court it belongs to (the card shows that court's name, size and price) and the booking dialog books that court.

## Tasks

- [ ] T1 S1 S3 · inline · server: `Cancha.jugadores` + migration, DTOs (required on create, optional on update, filter on list), list filter, agenda answer, tests · commit: see git log "size of the court" (server suite 419 green, tsc clean)
- [ ] T2 S4 · inline · server chat: `Mensaje.ofertaCanchaId` + migration, an owner may offer a slot of any of their courts, the offer view uses the offered court (with size), tests · commit: see git log "offer a slot of any court" (server suite 423 green)
- [ ] T3 S1 S2 S3 S4 · inline · client: form with required size, size on every card/dialog/agenda/offer/header, filter in "Explorar canchas", chat panel with all courts · commit: -
- [ ] T4 · inline · live check against the real database, docs and pending list · commit: -

## Log

- L1 2026-11-15 user, verbatim, after "1- funciona perfecto" about the previous chat improvements: "me acabo de dar cuenta que tiene que exitir la opcion de la cancha que se va a reservar de cuanto es: 5 jugadores, de 7 jugadores, de 9 jugadores o de 11 jugadores. ya que cada dueño tiene diferentes tamaños de canchas y se pueden ofrecer segun los tamaños de las canchas."
