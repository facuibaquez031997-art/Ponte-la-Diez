# Player profile and "Falta uno" notifications
Objective: player profile with photos, and "falta un jugador" alerts to players of the same neighborhood; contacts come later.
Branch: feat/perfil-falta-uno (to create at first work-unit commit) · Delivery: ask-on-risk · Test runner: Jest (server), tsc + eslint (client)

## Specs
- S1. Player profile: the user has a profile where they can add photos. ("al poder ingresar como jugador tambien hay que trabajar en crear el perfil del usuario, que pueda agregar fotos")
- S2. From the profile the player can send a notification to warn that a player is missing. ("que tenga su perfil en el cual pueda enviar notoficaciones para avisar que falta un jugador")
- S3. The notification states the court (cancha), the position of the missing player, and a free text field. ("pueda aclarar la cancha, la posicion del jugador que falta y un campo de texto en el cual pueda agregar el texto de más que necesite")
- S4. Audience, first delivery: players of the same neighborhood. ("barrio primero y contactos despues")
- S5. Audience, second delivery: contacts the player adds. ("la idea de armar el sistema de contactos no me parece mal")
- S6. Assumption (not requested): `Convocatoria` gets an `alcance` field (BARRIO / CONTACTOS) so S5 needs no rework.

## Tasks
- [~] T1 (S1) Profile: view/edit own data, `barrioPontevedra` from a fixed list (pending #13) · route: inline · RED: barrios.spec.ts failed on missing modules, GREEN: 8 tests pass, tsc+eslint clean · live check pending (running backend is stale, GET /api/users/barrios returns 404) · commit: -
- [ ] T2 (S1) Profile photos: upload, list, delete · route: inline · commit: -
- [ ] T3 (S3, S6) Schema: position, message and `alcance` on `Convocatoria`; CRUD endpoints · route: inline · commit: -
- [ ] T4 (S2, S4) Web push: subscribe and notify same-neighborhood players, with in-app inbox (pending #14) · route: inline · commit: -
- [ ] T5 (S2, S3) Client: "Falta uno" form in the profile · route: inline · commit: -
- [ ] T6 (S5) Contacts system and audience CONTACTOS · route: inline · commit: - (second delivery)

## Log
- L1 (2026-11-02): "al poder ingresar como jugador tambien hay que trabajar en crear el perfil del usuario, que pueda agregar fotos, que tenga su perfil en el cual pueda enviar notoficaciones para avisar que falta un jugador y en la notoficacion pueda aclarar la cancha, la posicion del jugador que falta y un campo de texto en el cual pueda agregar el texto de más que necesite. por el momento es esto."
- L2 (2026-11-02): "que problemas podria generar que las notificaciones push pueda el usuario decidir que sea a los jugadores del mismo barrio o a los amigos de contactos que el jugador agregue? la idea de armar el sistema de contactos no me parece mal."
- L3 (2026-11-02): "dale, barrio primero y contactos despues."
- L4 (2026-11-02): "todos deben comenzar con "Barrio" y su respectivo nombre. te paso todos los barrios: La Favela, Unión 2, El Mate, El Sol, San Jose, Alegre, La Covito, El Alto, El Bajo, Renabap 6351, Monte Cardacci, El Monte, San Francisco, Los Perales, Maria Victoria, Las Margaritas, El Zorzal, Papa Francisco, La Estrella, La Cambacita"
- L5 (2026-11-02): "me faltan barrios." then "El Edén, Juan Perón, Santa Julia, Renabap 1116, El Ombú, Juancito, Santa Ana, Veinticiete de Abril, Tres de Noviembre, Villa Angélica, Cabulli, Las Torres, El Vivero, José Diecinueve de Septiembre"
- L6 (2026-11-02): "frena" (stopped before any code was written for T1).
- Open: confirm spelling "Veinticiete de Abril" (likely "Veintisiete") before it goes into the fixed list (34 neighborhoods, each prefixed "Barrio ").
