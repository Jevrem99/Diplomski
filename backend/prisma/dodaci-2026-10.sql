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
