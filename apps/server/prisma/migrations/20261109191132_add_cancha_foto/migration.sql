-- CreateTable
CREATE TABLE "CanchaFoto" (
    "id" TEXT NOT NULL,
    "canchaId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanchaFoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanchaFoto_publicId_key" ON "CanchaFoto"("publicId");

-- CreateIndex
CREATE INDEX "CanchaFoto_canchaId_createdAt_idx" ON "CanchaFoto"("canchaId", "createdAt");

-- AddForeignKey
ALTER TABLE "CanchaFoto" ADD CONSTRAINT "CanchaFoto_canchaId_fkey" FOREIGN KEY ("canchaId") REFERENCES "Cancha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
