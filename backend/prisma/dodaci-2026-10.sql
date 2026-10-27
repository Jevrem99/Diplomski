-- Dodaci šeme (oktobar 2026): potreban broj dežurnih, grupe predmeta, ključ grupe na terminu.
-- Baza je pravljena sa "prisma db push", pa se dodaci primenjuju ovim fajlom:
--   npm run db:dodaci        (iz glavnog foldera ili iz foldera backend)
-- Bezbedno je pokrenuti više puta (IF NOT EXISTS). Postojeći podaci se ne menjaju.

ALTER TABLE "Ispit" ADD COLUMN IF NOT EXISTS "grupa_kljuc" TEXT;
CREATE INDEX IF NOT EXISTS "Ispit_grupa_kljuc_idx" ON "Ispit"("grupa_kljuc");

ALTER TABLE "TerminKolokvijuma"
    ADD COLUMN IF NOT EXISTS "k1_dezurni" INTEGER,
    ADD COLUMN IF NOT EXISTS "k2_dezurni" INTEGER,
    ADD COLUMN IF NOT EXISTS "k3_dezurni" INTEGER,
    ADD COLUMN IF NOT EXISTS "popravni_dezurni" INTEGER;

CREATE TABLE IF NOT EXISTS "GrupaPredmeta" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrupaPredmeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "_PredmetiUGrupi" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_PredmetiUGrupi_A_fkey" FOREIGN KEY ("A") REFERENCES "GrupaPredmeta"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PredmetiUGrupi_B_fkey" FOREIGN KEY ("B") REFERENCES "Predmet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "_PredmetiUGrupi_AB_unique" ON "_PredmetiUGrupi"("A", "B");
CREATE INDEX IF NOT EXISTS "_PredmetiUGrupi_B_index" ON "_PredmetiUGrupi"("B");

-- Podešavanja integracije (ključ za preuzimanje rezervacija, adresa za slanje JSON-a)
CREATE TABLE IF NOT EXISTS "Podesavanje" (
    "kljuc" TEXT NOT NULL,
    "vrednost" TEXT NOT NULL,
    "azurirano" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Podesavanje_pkey" PRIMARY KEY ("kljuc")
);

-- Sačuvane verzije rasporeda
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

-- Termin u više sala
CREATE TABLE IF NOT EXISTS "_DodatneSale" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DodatneSale_A_fkey" FOREIGN KEY ("A") REFERENCES "Ispit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DodatneSale_B_fkey" FOREIGN KEY ("B") REFERENCES "Sala"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "_DodatneSale_AB_unique" ON "_DodatneSale"("A", "B");
CREATE INDEX IF NOT EXISTS "_DodatneSale_B_index" ON "_DodatneSale"("B");

-- Status slanja rezervacije sistemu fakulteta
ALTER TABLE "Ispit"
    ADD COLUMN IF NOT EXISTS "rezervacija_status" TEXT,
    ADD COLUMN IF NOT EXISTS "rezervacija_poruka" TEXT,
    ADD COLUMN IF NOT EXISTS "rezervacija_vreme" TIMESTAMP(3);

-- Rezervacije napravljene u sistemu fakulteta
CREATE TABLE IF NOT EXISTS "RezervacijaFakulteta" (
    "id" SERIAL NOT NULL,
    "kljuc" TEXT NOT NULL,
    "id_rezervacije" INTEGER NOT NULL,
    "ispiti" INTEGER[] NOT NULL DEFAULT '{}',
    "sala" TEXT NOT NULL,
    "datum" TEXT NOT NULL,
    "vreme_od" TEXT NOT NULL,
    "vreme_do" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RezervacijaFakulteta_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RezervacijaFakulteta_id_rezervacije_idx" ON "RezervacijaFakulteta"("id_rezervacije");
