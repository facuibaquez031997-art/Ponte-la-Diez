-- CreateEnum
CREATE TYPE "MotivoCierre" AS ENUM ('VENCIDA', 'CANCELADA_DUENO');

-- CreateEnum
CREATE TYPE "EstadoDevolucion" AS ENUM ('NO_CORRESPONDE', 'PENDIENTE', 'HECHA');

-- CreateTable
CREATE TABLE "HistorialReserva" (
    "id" TEXT NOT NULL,
    "canchaId" TEXT NOT NULL,
    "jugadorId" TEXT NOT NULL,
    "turnoInicio" TIMESTAMP(3) NOT NULL,
    "turnoFin" TIMESTAMP(3) NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "montoPagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mpPaymentId" TEXT,
    "motivo" "MotivoCierre" NOT NULL,
    "devolucion" "EstadoDevolucion" NOT NULL,
    "devueltoAt" TIMESTAMP(3),
    "reservadaAt" TIMESTAMP(3) NOT NULL,
    "cerradaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialReserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistorialReserva_canchaId_cerradaAt_idx" ON "HistorialReserva"("canchaId", "cerradaAt");

-- AddForeignKey
ALTER TABLE "HistorialReserva" ADD CONSTRAINT "HistorialReserva_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "Cancha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialReserva" ADD CONSTRAINT "HistorialReserva_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
