-- CreateTable
CREATE TABLE "HorarioCancha" (
    "id" TEXT NOT NULL,
    "canchaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "minutoInicio" INTEGER NOT NULL,
    "minutoFin" INTEGER NOT NULL,

    CONSTRAINT "HorarioCancha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorarioCancha_canchaId_diaSemana_idx" ON "HorarioCancha"("canchaId", "diaSemana");

-- AddForeignKey
ALTER TABLE "HorarioCancha" ADD CONSTRAINT "HorarioCancha_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "Cancha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
