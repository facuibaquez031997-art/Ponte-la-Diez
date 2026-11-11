-- CreateEnum
CREATE TYPE "RespuestaEstado" AS ENUM ('ACEPTADA', 'DECLINADA');

-- CreateTable
CREATE TABLE "RespuestaConvocatoria" (
    "id" TEXT NOT NULL,
    "convocatoriaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estado" "RespuestaEstado" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespuestaConvocatoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RespuestaConvocatoria_convocatoriaId_userId_key" ON "RespuestaConvocatoria"("convocatoriaId", "userId");

-- AddForeignKey
ALTER TABLE "RespuestaConvocatoria" ADD CONSTRAINT "RespuestaConvocatoria_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "Convocatoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaConvocatoria" ADD CONSTRAINT "RespuestaConvocatoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
