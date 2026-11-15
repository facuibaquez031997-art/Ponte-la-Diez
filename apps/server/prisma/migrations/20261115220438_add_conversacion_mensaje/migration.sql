-- CreateTable
CREATE TABLE "Conversacion" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT,
    "canchaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "turnoInicio" TIMESTAMP(3),
    "jugadorLeyoHasta" TIMESTAMP(3),
    "duenoLeyoHasta" TIMESTAMP(3),
    "jugadorEliminoAt" TIMESTAMP(3),
    "duenoEliminoAt" TIMESTAMP(3),
    "ultimoMensajeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversacion_reservaId_key" ON "Conversacion"("reservaId");

-- CreateIndex
CREATE INDEX "Conversacion_jugadorId_ultimoMensajeAt_idx" ON "Conversacion"("jugadorId", "ultimoMensajeAt");

-- CreateIndex
CREATE INDEX "Conversacion_canchaId_ultimoMensajeAt_idx" ON "Conversacion"("canchaId", "ultimoMensajeAt");

-- CreateIndex
CREATE INDEX "Mensaje_conversacionId_createdAt_idx" ON "Mensaje"("conversacionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "Cancha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversacion" ADD CONSTRAINT "Conversacion_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
