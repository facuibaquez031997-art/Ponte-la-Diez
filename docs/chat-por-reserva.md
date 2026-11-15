# Chat con el dueño, colgado de la reserva

**Estado:** construido en la rama `feat/chat-por-reserva` (seguimiento en `odd/tasks/chat-por-reserva.md`). Lo que difiere del diseño original se marca como *Implementado así*.

**Origen** (palabras del programador): *"que el usuario tenga la posibilidad de enviar un mensaje, de poder comunicarse con el dueño de cancha seria bueno para terminar de eleguir el horario concretamente"* y *"no deberian de ser automaticas solamente, tiene que tener la opcion de estar comunicandose con el dueño de la cancha que se que esta como pendiente tambien"*. Decisión: *"dejemos lo del chat con el dueño aparte diseñandolo ya colgado en la reserva"*.

## Referencia de Stitch

Pantalla "Mensajes & Chat": lista de conversaciones a la izquierda, hilo a la derecha. El hilo trae un banner **Turno activo** (día, hora, cancha, estado CONFIRMADO, seña acreditada por Mercado Pago), el botón **Ver reserva** y acciones rápidas. El panel del dueño tiene una pestaña **Mensajes** con contador.

La v1 cubre solo jugador ↔ dueño. Los chats de equipos de "Falta uno" y el soporte quedan fuera.

## Idea central

Cada reserva tiene su propia conversación. Los participantes salen de la reserva: el **jugador** es quien reservó y el **dueño** es el de la cancha. Nadie más puede leerla ni escribir.

Alternativa descartada: una sola conversación por jugador y cancha. Mezclaría turnos distintos en un mismo hilo y el dueño no sabría de cuál se habla.

## El problema que hay que resolver primero

Una reserva sin pagar se **borra a los 15 minutos** (decisión A2 de los pagos). Si la conversación dependiera de la reserva, se perdería justo cuando el jugador está charlando para decidir.

**Propuesta:** la conversación sobrevive a la reserva. Guarda una copia de lo que necesita el banner (cancha, día y hora del turno) y, cuando la reserva se libera, pierde el vínculo y el banner dice *"El turno volvió a quedar libre"*. El jugador puede volver a reservar desde ahí.

## Datos propuestos

```prisma
model Conversacion {
  id              String    @id @default(uuid())
  reservaId       String?   @unique          // opcional: nace sin reserva o se anula si la reserva se libera
  reserva         Reserva?  @relation(fields: [reservaId], references: [id], onDelete: SetNull)
  canchaId        String                      // para la bandeja del dueño
  cancha          Cancha    @relation(fields: [canchaId], references: [id])
  jugadorId       String                      // siempre quien inició la conversación
  jugador         User      @relation(fields: [jugadorId], references: [id])
  turnoInicio     DateTime?                   // copia para el banner, solo si hay reserva
  jugadorLeyoHasta DateTime?                  // para contar no leídos
  duenoLeyoHasta   DateTime?
  jugadorEliminoAt DateTime?                  // el jugador eliminó el chat de su bandeja
  duenoEliminoAt   DateTime?                  // el dueño eliminó el chat de su bandeja
  ultimoMensajeAt  DateTime?
  mensajes        Mensaje[]
}

model Mensaje {
  id              String   @id @default(uuid())
  conversacionId  String
  autorId         String
  cuerpo          String                      // máximo 1000 caracteres
  createdAt       DateTime @default(now())
}
```

## Endpoints propuestos

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /conversaciones` (`canchaId`, `reservaId` opcional) | solo jugador | crea la conversación o devuelve la que ya existe. *Implementado así*: el dueño no inicia nunca, y la reserva es opcional |
| `GET /conversaciones` | jugador o dueño | sus conversaciones, con último mensaje y no leídos (sin las ocultas ni las vacías) |
| `GET /conversaciones/no-leidas` | jugador o dueño | total de mensajes sin leer, para la campanita |
| `DELETE /conversaciones/:id` | los dos participantes | *Implementado así*: oculta el chat solo para quien lo elimina |
| `GET /conversaciones/:id/mensajes` | los dos participantes | el hilo, con paginado |
| `POST /conversaciones/:id/mensajes` | los dos participantes | envía un mensaje (`cuerpo`) |
| `POST /conversaciones/:id/leida` | los dos participantes | marca el hilo como leído |

Quien no participa recibe 404, no 403, para no revelar que la conversación existe.

## Tiempo real y avisos

- **v1 con consulta periódica:** cada 5 segundos mientras el hilo está abierto y cada 30 para la campanita. Es lo mismo que ya hace la pantalla de resultado del pago. Websocket o SSE queda para después (Stitch muestra "Conexión en vivo").
- **Aviso al otro participante:** una notificación con `conversacionId` y push. Para no llenar la bandeja, **una sola notificación sin leer por conversación**: los mensajes siguientes la actualizan en vez de crear otra.

## Pantallas

- Ruta `/mensajes`: lista a la izquierda, hilo a la derecha, como Stitch.
- Puntos de entrada: botón **"Hablar con el dueño"** en cada tarjeta de "Mis reservas" (también en las pendientes), botón **"Consultar al dueño"** en la tarjeta de cada cancha (sin reserva), botón **"Responder"** en la fila de las reservas del dueño (solo si el jugador ya escribió), y el enlace **Mensajes** del menú (jugador y dueño).
- Banner del turno con el estado de la reserva y los montos (pagado y a cobrar en la cancha).

## Seguridad y abuso

- Solo texto en la v1. Sin adjuntos, audio ni teléfono compartido de forma automática.
- Largo máximo de 1000 caracteres y límite de mensajes por minuto por usuario.
- Sin bloqueo ni reporte todavía: se relaciona con los pendientes #12, #25 y #26 y con el #33.

## Fuera de la v1

Acciones rápidas de Stitch (enviar comprobante, pedir ubicación, avisar que llegamos), adjuntos, audio, "en línea", chats de equipo y soporte.

## Decisiones que faltan antes de construir

**Decididas por el programador:**

1. **Se puede escribir antes de reservar.** Botón "Consultar al dueño" en la tarjeta de la cancha, con una conversación sin reserva.
2. **Solo el jugador inicia la conversación.** El dueño nunca la inicia: responde en las que el jugador abrió.
3. **Eliminar el chat es individual.** El jugador lo oculta de su bandeja (`jugadorEliminoAt`). **El dueño nunca pierde el chat de su bandeja:** al "vaciarlo" solo se borra su contenido (`duenoEliminoAt`) y la conversación queda listada como "Chat vaciado", para no perder una consulta de un turno por accidente. En los dos casos el otro participante conserva el hilo intacto.

4. **Si el otro escribe en un chat que eliminaste, reaparece solo con los mensajes posteriores a la eliminación** (`createdAt > eliminoAt`). Si nunca lo eliminaste, ves todo el historial. El chat está oculto mientras `ultimoMensajeAt <= eliminoAt`.

5. **Los mensajes se guardan mientras exista la cancha.** Si la cancha se borra, sus hilos se borran con ella; si tiene reservas con plata pagada, la cancha se conserva en el historial (commit `95f4a37`) y sus hilos también.

**Faltan:** ninguna decisión de producto. Queda definir en la construcción el límite de frecuencia (mensajes por minuto) y la moderación (pendiente #33).

## Qué se verifica cuando se construya

- Solo los dos participantes leen o escriben; un tercero recibe 404.
- Los no leídos suben y bajan bien para cada lado.
- Si la reserva se libera, el hilo sigue y el banner lo dice.
- Una ráfaga de mensajes deja una sola notificación sin leer.
- El límite de largo y de frecuencia responde con un error claro.
