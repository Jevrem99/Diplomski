-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "uloga" TEXT NOT NULL DEFAULT 'asistent',
    "reset_token" TEXT,
    "reset_token_exp" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profesor" (
    "id" SERIAL NOT NULL,
    "ime" TEXT NOT NULL,
    "prezime" TEXT NOT NULL,
    "is_saradnik" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Predmet" (
    "id" SERIAL NOT NULL,
    "sifra" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "godina" INTEGER NOT NULL,
    "semestar" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "broj_studenata" INTEGER NOT NULL DEFAULT 0,
    "profesor_id" INTEGER,

    CONSTRAINT "Predmet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sala" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "kapacitet" INTEGER,

    CONSTRAINT "Sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ispit" (
    "id" SERIAL NOT NULL,
    "predmet_id" INTEGER,
    "datum" TIMESTAMP(3) NOT NULL,
    "vreme" TIME(6) NOT NULL,
    "vreme_kraja" TIME(6),
    "sala_id" INTEGER,
    "tip_kolokvijuma" TEXT,
    "is_ispit" BOOLEAN NOT NULL DEFAULT true,
    "is_izmenjen" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "grupa_kljuc" TEXT,

    CONSTRAINT "Ispit_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Dezurstva" (
    "id" SERIAL NOT NULL,
    "ispit_id" INTEGER,
    "saradnik_id" INTEGER,

    CONSTRAINT "Dezurstva_pkey" PRIMARY KEY ("id")
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
    "k1_dezurni" INTEGER,
    "k2_dezurni" INTEGER,
    "k3_dezurni" INTEGER,
    "popravni_dezurni" INTEGER,
    "napomena" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminKolokvijuma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZahtevZamene" (
    "id" SERIAL NOT NULL,
    "dezurstvo_id" INTEGER NOT NULL,
    "trazilac_id" INTEGER NOT NULL,
    "predlozeni_id" INTEGER,
    "razlog" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'na_cekanju',
    "napomena_admina" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "ZahtevZamene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupaPredmeta" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupaPredmeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AngazovaniSaradnici" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_PredmetiUGrupi" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Predmet_sifra_key" ON "Predmet"("sifra");

-- CreateIndex
CREATE INDEX "Predmet_profesor_id_idx" ON "Predmet"("profesor_id");

-- CreateIndex
CREATE UNIQUE INDEX "Sala_naziv_key" ON "Sala"("naziv");

-- CreateIndex
CREATE INDEX "Ispit_predmet_id_idx" ON "Ispit"("predmet_id");

-- CreateIndex
CREATE INDEX "Ispit_datum_idx" ON "Ispit"("datum");

-- CreateIndex
CREATE INDEX "Ispit_sala_id_idx" ON "Ispit"("sala_id");

-- CreateIndex
CREATE INDEX "Ispit_is_published_idx" ON "Ispit"("is_published");

-- CreateIndex
CREATE INDEX "Ispit_grupa_kljuc_idx" ON "Ispit"("grupa_kljuc");

-- CreateIndex
CREATE INDEX "RedovnaNastava_sala_id_datum_idx" ON "RedovnaNastava"("sala_id", "datum");

-- CreateIndex
CREATE INDEX "Obaveza_saradnik_id_idx" ON "Obaveza"("saradnik_id");

-- CreateIndex
CREATE INDEX "Obaveza_datum_idx" ON "Obaveza"("datum");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "Dezurstva_ispit_id_idx" ON "Dezurstva"("ispit_id");

-- CreateIndex
CREATE INDEX "Dezurstva_saradnik_id_idx" ON "Dezurstva"("saradnik_id");

-- CreateIndex
CREATE UNIQUE INDEX "TerminKolokvijuma_predmet_id_key" ON "TerminKolokvijuma"("predmet_id");

-- CreateIndex
CREATE INDEX "ZahtevZamene_status_idx" ON "ZahtevZamene"("status");

-- CreateIndex
CREATE INDEX "ZahtevZamene_trazilac_id_idx" ON "ZahtevZamene"("trazilac_id");

-- CreateIndex
CREATE INDEX "ZahtevZamene_dezurstvo_id_idx" ON "ZahtevZamene"("dezurstvo_id");

-- CreateIndex
CREATE UNIQUE INDEX "_AngazovaniSaradnici_AB_unique" ON "_AngazovaniSaradnici"("A", "B");

-- CreateIndex
CREATE INDEX "_AngazovaniSaradnici_B_index" ON "_AngazovaniSaradnici"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PredmetiUGrupi_AB_unique" ON "_PredmetiUGrupi"("A", "B");

-- CreateIndex
CREATE INDEX "_PredmetiUGrupi_B_index" ON "_PredmetiUGrupi"("B");

-- AddForeignKey
ALTER TABLE "Predmet" ADD CONSTRAINT "Predmet_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ispit" ADD CONSTRAINT "Ispit_predmet_id_fkey" FOREIGN KEY ("predmet_id") REFERENCES "Predmet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ispit" ADD CONSTRAINT "Ispit_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "Sala"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedovnaNastava" ADD CONSTRAINT "RedovnaNastava_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "Sala"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obaveza" ADD CONSTRAINT "Obaveza_saradnik_id_fkey" FOREIGN KEY ("saradnik_id") REFERENCES "Profesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dezurstva" ADD CONSTRAINT "Dezurstva_ispit_id_fkey" FOREIGN KEY ("ispit_id") REFERENCES "Ispit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dezurstva" ADD CONSTRAINT "Dezurstva_saradnik_id_fkey" FOREIGN KEY ("saradnik_id") REFERENCES "Profesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminKolokvijuma" ADD CONSTRAINT "TerminKolokvijuma_predmet_id_fkey" FOREIGN KEY ("predmet_id") REFERENCES "Predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZahtevZamene" ADD CONSTRAINT "ZahtevZamene_dezurstvo_id_fkey" FOREIGN KEY ("dezurstvo_id") REFERENCES "Dezurstva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZahtevZamene" ADD CONSTRAINT "ZahtevZamene_trazilac_id_fkey" FOREIGN KEY ("trazilac_id") REFERENCES "Profesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZahtevZamene" ADD CONSTRAINT "ZahtevZamene_predlozeni_id_fkey" FOREIGN KEY ("predlozeni_id") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AngazovaniSaradnici" ADD CONSTRAINT "_AngazovaniSaradnici_A_fkey" FOREIGN KEY ("A") REFERENCES "Predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AngazovaniSaradnici" ADD CONSTRAINT "_AngazovaniSaradnici_B_fkey" FOREIGN KEY ("B") REFERENCES "Profesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PredmetiUGrupi" ADD CONSTRAINT "_PredmetiUGrupi_A_fkey" FOREIGN KEY ("A") REFERENCES "GrupaPredmeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PredmetiUGrupi" ADD CONSTRAINT "_PredmetiUGrupi_B_fkey" FOREIGN KEY ("B") REFERENCES "Predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Podesavanje" (
    "kljuc" TEXT NOT NULL,
    "vrednost" TEXT NOT NULL,
    "azurirano" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Podesavanje_pkey" PRIMARY KEY ("kljuc")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SacuvaniRaspored" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "autor" TEXT,
    "datum_od" TEXT,
    "datum_do" TEXT,
    "broj_termina" INTEGER NOT NULL DEFAULT 0,
    "podaci" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SacuvaniRaspored_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SacuvaniRaspored_created_at_idx" ON "SacuvaniRaspored"("created_at");

-- CreateTable
CREATE TABLE IF NOT EXISTS "_DodatneSale" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DodatneSale_A_fkey" FOREIGN KEY ("A") REFERENCES "Ispit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DodatneSale_B_fkey" FOREIGN KEY ("B") REFERENCES "Sala"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "_DodatneSale_AB_unique" ON "_DodatneSale"("A", "B");
CREATE INDEX IF NOT EXISTS "_DodatneSale_B_index" ON "_DodatneSale"("B");

-- AlterTable
ALTER TABLE "Ispit"
    ADD COLUMN IF NOT EXISTS "rezervacija_status" TEXT,
    ADD COLUMN IF NOT EXISTS "rezervacija_poruka" TEXT,
    ADD COLUMN IF NOT EXISTS "rezervacija_vreme" TIMESTAMP(3);
