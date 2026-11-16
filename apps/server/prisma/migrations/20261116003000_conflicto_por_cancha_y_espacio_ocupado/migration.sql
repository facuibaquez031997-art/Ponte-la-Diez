-- AlterEnum
ALTER TYPE "MotivoCierre" ADD VALUE 'ESPACIO_OCUPADO';

-- AlterTable
ALTER TABLE "CanchaConflicto" DROP CONSTRAINT "CanchaConflicto_pkey",
ADD COLUMN     "numero" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otraNumero" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "CanchaConflicto_pkey" PRIMARY KEY ("canchaId", "numero", "otraCanchaId", "otraNumero");

