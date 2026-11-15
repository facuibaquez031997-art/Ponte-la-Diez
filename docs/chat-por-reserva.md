# Chat con el dueño, colgado de la reserva

**Estado:** solo diseño. No hay código. Se construye como feature aparte, después de cerrar los pagos.

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
  reservaId       String?   @unique          // se anula si la reserva se libera
  reserva         Reserva?  @relation(fields: [reservaId], references: [id], onDelete: SetNull)
  canchaId        String                      // para la bandeja del dueño
  jugadorId       String
  turnoInicio     DateTime                    // copia para el banner
  jugadorLeyoHasta DateTime?                  // para contar no leídos
  duenoLeyoHasta   DateTime?
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
| `POST /reservas/:id/conversacion` | jugador o dueño de esa reserva | crea la conversación o devuelve la que ya existe |
| `GET /conversaciones` | jugador o dueño | sus conversaciones, con último mensaje y no leídos |
| `GET /conversaciones/:id/mensajes` | los dos participantes | el hilo, con paginado |
| `POST /conversaciones/:id/mensajes` | los dos participantes | envía un mensaje (`cuerpo`) |
| `POST /conversaciones/:id/leida` | los dos participantes | marca el hilo como leído |

Quien no participa recibe 404, no 403, para no revelar que la conversación existe.

## Tiempo real y avisos

- **v1 con consulta periódica:** cada 5 segundos mientras el hilo está abierto y cada 30 para la campanita. Es lo mismo que ya hace la pantalla de resultado del pago. Websocket o SSE queda para después (Stitch muestra "Conexión en vivo").
- **Aviso al otro participante:** una notificación con `conversacionId` y push. Para no llenar la bandeja, **una sola notificación sin leer por conversación**: los mensajes siguientes la actualizan en vez de crear otra.

## Pantallas

- Ruta `/mensajes`: lista a la izquierda, hilo a la derecha, como Stitch.
- Puntos de entrada: botón **"Hablar con el dueño"** en cada tarjeta de "Mis reservas" (también en las pendientes), botón **"Responder"** en cada fila de las reservas del dueño, y el enlace **Mensajes** del menú, que hoy apunta a `#`.
- Banner del turno con el estado de la reserva y los montos (pagado y a cobrar en la cancha).

## Seguridad y abuso

- Solo texto en la v1. Sin adjuntos, audio ni teléfono compartido de forma automática.
- Largo máximo de 1000 caracteres y límite de mensajes por minuto por usuario.
- Sin bloqueo ni reporte todavía: se relaciona con los pendientes #12, #25 y #26 y con el #33.

## Fuera de la v1

Acciones rápidas de Stitch (enviar comprobante, pedir ubicación, avisar que llegamos), adjuntos, audio, "en línea", chats de equipo y soporte.

## Decisiones que faltan antes de construir

1. **¿Se puede escribir antes de reservar?** Con este diseño, el hilo nace de una reserva (aunque sea pendiente). Si querés consultar sin tomar un turno, hay que sumar un botón "Consultar al dueño" en la tarjeta de la cancha, con una conversación sin reserva.
2. **¿Puede el dueño iniciar la conversación** en una reserva pendiente? Recomendado: sí.
3. **¿Cuánto se guardan los mensajes?** Recomendado: mientras exista la cancha.

## Qué se verifica cuando se construya

- Solo los dos participantes leen o escriben; un tercero recibe 404.
- Los no leídos suben y bajan bien para cada lado.
- Si la reserva se libera, el hilo sigue y el banner lo dice.
- Una ráfaga de mensajes deja una sola notificación sin leer.
- El límite de largo y de frecuencia responde con un error claro.
