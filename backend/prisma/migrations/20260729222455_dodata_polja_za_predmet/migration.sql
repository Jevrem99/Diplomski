/*
  Warnings:

  - A unique constraint covering the columns `[sifra]` on the table `Predmet` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `godina` to the `Predmet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Predmet" ADD COLUMN     "godina" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Predmet_sifra_key" ON "Predmet"("sifra");
