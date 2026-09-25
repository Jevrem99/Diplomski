-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Ispit" ADD COLUMN     "is_izmenjen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sala_id" INTEGER,
ADD COLUMN     "vreme_kraja" TIME(6),
ALTER COLUMN "datum" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "is_ispit" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Predmet" ADD COLUMN     "broj_studenata" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Profesor" ADD COLUMN     "email" TEXT,
ALTER COLUMN "is_saradnik" SET DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_exp" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Sala" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "kapacitet" INTEGER,

    CONSTRAINT "Sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedovnaNastava" (
    "id" SERIAL NOT NULL,
    "sala_id" INTEGER NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "vreme_pocetka" TEXT NOT NULL,
    "vreme_kraja" TEXT NOT NULL,
    "predmet" TEXT NOT NULL,
    "nastavnik" TEXT,

    CONSTRAINT "RedovnaNastava_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obaveza" (
    "id" SERIAL NOT NULL,
    "saradnik_id" INTEGER NOT NULL,
    "dan_u_nedelji" INTEGER,
    "datum" DATE,
    "datum_do" DATE,
    "vreme_pocetka" TIME(6),
    "vreme_kraja" TIME(6),
    "tip_obaveze" TEXT,

    CONSTRAINT "Obaveza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "korisnik" TEXT NOT NULL,
    "akcija" TEXT NOT NULL,
    "entitet" TEXT NOT NULL,
    "detalji" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminKolokvijuma" (
    "id" SERIAL NOT NULL,
    "predmet_id" INTEGER NOT NULL,
    "k1_datum" TEXT,
    "k1_trajanje" INTEGER,
    "k1_racunarska_sala" BOOLEAN NOT NULL DEFAULT false,
    "k2_datum" TEXT,
    "k2_trajanje" INTEGER,
    "k2_racunarska_sala" BOOLEAN NOT NULL DEFAULT false,
    "k3_datum" TEXT,
    "k3_trajanje" INTEGER,
    "k3_racunarska_sala" BOOLEAN NOT NULL DEFAULT false,
    "popravni_u_terminu_ispita" BOOLEAN NOT NULL DEFAULT false,
    "popravni_trajanje" INTEGER,
    "popravni_racunarska_sala" BOOLEAN NOT NULL DEFAULT false,
    "napomena" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminKolokvijuma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AngazovaniSaradnici" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AngazovaniSaradnici_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sala_naziv_key" ON "Sala"("naziv");

-- CreateIndex
CREATE UNIQUE INDEX "TerminKolokvijuma_predmet_id_key" ON "TerminKolokvijuma"("predmet_id");

-- CreateIndex
CREATE INDEX "_AngazovaniSaradnici_B_index" ON "_AngazovaniSaradnici"("B");

-- AddForeignKey
ALTER TABLE "Ispit" ADD CONSTRAINT "Ispit_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "Sala"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedovnaNastava" ADD CONSTRAINT "RedovnaNastava_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obaveza" ADD CONSTRAINT "Obaveza_saradnik_id_fkey" FOREIGN KEY ("saradnik_id") REFERENCES "Profesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminKolokvijuma" ADD CONSTRAINT "TerminKolokvijuma_predmet_id_fkey" FOREIGN KEY ("predmet_id") REFERENCES "Predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AngazovaniSaradnici" ADD CONSTRAINT "_AngazovaniSaradnici_A_fkey" FOREIGN KEY ("A") REFERENCES "Predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AngazovaniSaradnici" ADD CONSTRAINT "_AngazovaniSaradnici_B_fkey" FOREIGN KEY ("B") REFERENCES "Profesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
