-- CreateEnum
CREATE TYPE "ContactoEstado" AS ENUM ('PENDIENTE', 'ACEPTADO');

-- CreateTable
CREATE TABLE "Contacto" (
    "id" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "estado" "ContactoEstado" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contacto_destinatarioId_estado_idx" ON "Contacto"("destinatarioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Contacto_solicitanteId_destinatarioId_key" ON "Contacto"("solicitanteId", "destinatarioId");

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contacto" ADD CONSTRAINT "Contacto_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
