/*
  Warnings:

  - Added the required column `posicion` to the `Convocatoria` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Posicion" AS ENUM ('ARQUERO', 'DEFENSOR', 'MEDIOCAMPISTA', 'DELANTERO');

-- CreateEnum
CREATE TYPE "Alcance" AS ENUM ('BARRIO', 'CONTACTOS');

-- AlterTable
ALTER TABLE "Convocatoria" ADD COLUMN     "alcance" "Alcance" NOT NULL DEFAULT 'BARRIO',
ADD COLUMN     "mensaje" TEXT,
ADD COLUMN     "posicion" "Posicion" NOT NULL;
