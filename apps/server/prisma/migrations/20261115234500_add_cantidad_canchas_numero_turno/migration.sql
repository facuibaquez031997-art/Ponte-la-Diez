-- DropIndex
DROP INDEX "Turno_canchaId_fechaHoraInicio_key";

-- AlterTable
ALTER TABLE "Cancha" ADD COLUMN     "cantidad" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Turno" ADD COLUMN     "numero" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Turno_canchaId_fechaHoraInicio_numero_key" ON "Turno"("canchaId", "fechaHoraInicio", "numero");

