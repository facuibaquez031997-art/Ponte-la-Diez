-- AlterTable
ALTER TABLE "Notificacion" ADD COLUMN     "conversacionId" TEXT;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
