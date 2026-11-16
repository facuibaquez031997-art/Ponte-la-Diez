Objective: an owner can say which of their court entries use the same physical space (for example one court of 11 that is divided into 3 of 5), and booking one blocks the others at that hour.
Branch: feat/canchas-compartidas (from feat/multi-cancha, because it builds on the quantity of courts per entry) · Delivery: ask-on-risk · Test runner: vitest (`npm test` in apps/server), client: `tsc -b` + eslint (no client test runner)

## Specs

- S1 Booking one blocks the other, user words (L1), answering the question "¿Querés que reservar la de 11 bloquee las de 5 de ese horario, y que reservar una de 5 bloquee la de 11?": "si, que reservar una bloquee a la otra. por ejemplo la reserva de la cancha de 5 se concreta entonces quedan dos turnos disponibles, pero la cancha de 11 se bloquea. y si la cancha de 11 se reserva entonces las 3 canchas de 5 se bloquean." So: with an entry of 11 (quantity 1) and an entry of 5 (quantity 3) that share the space, booking one court of 5 at 18:00 leaves the other two of 5 free at 18:00 and blocks the 11 at 18:00; booking the 11 at 18:00 blocks the three of 5 at 18:00. Courts of the SAME entry never block each other (that is S2 of `multi-cancha.md`).
- S2 The owner says which entries share the space. Assumptions: A1 it is a link between two entries of the SAME owner, set from either one (the court form lists the owner's other entries to tick) and always symmetric, so ticking the 11 in the form of the 5 also makes the 5 block the 11; A2 an entry can share the space with several others; A3 the link is only about the same hour (the slots are whole hours, so two slots conflict when they start at the same time).
- S3 What "blocked" means, assumptions: A4 a slot is blocked while any slot of a linked entry at the same hour is RESERVED, and a booking that still waits for its payment (the 15 minute hold) already counts, so two players cannot pay for the same ground; when that booking expires, is cancelled by the owner or is refunded, the other slots free themselves (nothing is stored: it is derived each time); A5 a blocked slot does not show as free to the player in "Explorar canchas", cannot be booked (409), cannot be offered from the chat, an offer already made stops being bookable, and in the owner agenda it shows as "Bloqueada" with the name of the entry that holds the space.
- S4 The check at booking time has to hold when two players book the two linked entries at the same moment: exactly one wins (the other gets 409), never both. A5 bookings that already existed when a link is added stay as they are (nothing is cancelled): the link only blocks from then on.

## Tasks

- [ ] T1 S2 · inline · server: table of links between entries + migration, `comparteCon` when creating/editing a court (only the owner's own entries), returned in the owner's list, the helper that finds the blocked slots, tests · commit: see git log "entries that share the space" (server suite 477 green, tsc clean)
- [ ] T2 S1 S3 S4 · inline · server: booking checks the links under a lock per owner and hour, the public free list hides blocked slots, chat offers are validated and checked live against the links, the agenda marks blocked slots, tests · commit: -
- [ ] T3 S2 S3 · inline · client: "Comparte el espacio con" in the court form, blocked slots in the agenda (not offerable), owner court card · commit: -
- [ ] T4 · inline · live check against the real database (the 11 and the 3 of 5, including the two linked entries booked at the same moment), docs and pending list · commit: -

## Log

- L1 2026-11-15 user, verbatim, answering the question about the court of 11 split into 3 of 5: "si, que reservar una bloquee a la otra. por ejemplo la reserva de la cancha de 5 se concreta entonces quedan dos turnos disponibles, pero la cancha de 11 se bloquea. y si la cancha de 11 se reserva entonces las 3 canchas de 5 se bloquean."
- The earlier request that led here is L1 of `odd/tasks/multi-cancha.md` ("puede pasar que tengan un predio que tiene una cancha de once y esa la dividen en 3 canchas de 5 jugadores...").
