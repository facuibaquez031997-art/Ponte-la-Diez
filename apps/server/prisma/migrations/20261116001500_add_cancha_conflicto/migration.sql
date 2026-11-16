-- CreateTable
CREATE TABLE "CanchaConflicto" (
    "canchaId" TEXT NOT NULL,
    "otraCanchaId" TEXT NOT NULL,

    CONSTRAINT "CanchaConflicto_pkey" PRIMARY KEY ("canchaId","otraCanchaId")
);

-- CreateIndex
CREATE INDEX "CanchaConflicto_otraCanchaId_idx" ON "CanchaConflicto"("otraCanchaId");

-- AddForeignKey
ALTER TABLE "CanchaConflicto" ADD CONSTRAINT "CanchaConflicto_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "Cancha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanchaConflicto" ADD CONSTRAINT "CanchaConflicto_otraCanchaId_fkey" FOREIGN KEY ("otraCanchaId") REFERENCES "Cancha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

