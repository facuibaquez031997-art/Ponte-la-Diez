/*
  Warnings:

  - Added the required column `barrio` to the `Cancha` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Cancha" ADD COLUMN     "barrio" TEXT NOT NULL;
