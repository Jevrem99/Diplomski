-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "uloga" TEXT NOT NULL DEFAULT 'asistent',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profesor" (
    "id" SERIAL NOT NULL,
    "ime" TEXT NOT NULL,
    "prezime" TEXT NOT NULL,
    "is_saradnik" BOOLEAN NOT NULL,

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Predmet" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "semestar" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sifra" TEXT NOT NULL,
    "profesor_id" INTEGER,

    CONSTRAINT "Predmet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ispit" (
    "id" SERIAL NOT NULL,
    "predmet_id" INTEGER,
    "datum" DATE NOT NULL,
    "vreme" TIME NOT NULL,
    "is_ispit" BOOLEAN NOT NULL,

    CONSTRAINT "Ispit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dezurstva" (
    "id" SERIAL NOT NULL,
    "ispit_id" INTEGER,
    "saradnik_id" INTEGER,

    CONSTRAINT "Dezurstva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Predmet" ADD CONSTRAINT "Predmet_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ispit" ADD CONSTRAINT "Ispit_predmet_id_fkey" FOREIGN KEY ("predmet_id") REFERENCES "Predmet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dezurstva" ADD CONSTRAINT "Dezurstva_ispit_id_fkey" FOREIGN KEY ("ispit_id") REFERENCES "Ispit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dezurstva" ADD CONSTRAINT "Dezurstva_saradnik_id_fkey" FOREIGN KEY ("saradnik_id") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
