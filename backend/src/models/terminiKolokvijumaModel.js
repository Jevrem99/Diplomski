const { PrismaClient } = require('@prisma/client');
const prisma = require('../db/prisma');

// Dohvatanje predmeta na kojima je angažovan određeni profesor/asistent preko email-a
const getPredmetiZaAsistenta = async (email) => {
  if (!email) return [];
  const profesor = await prisma.profesor.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: {
      angazovanja: { include: { terminiKolokvijuma: true } },
      predmeti: { include: { terminiKolokvijuma: true } }
    }
  });
  if (!profesor) return [];

  // Predmet na kome je i glavni profesor i saradnik prikazujemo samo jednom
  const poId = new Map();
  [...profesor.predmeti, ...profesor.angazovanja].forEach((p) => poId.set(p.id, p));
  return [...poId.values()].sort((x, y) => x.godina - y.godina || x.naziv.localeCompare(y.naziv, 'sr'));
};

// Da li korisnik sme da menja termine datog predmeta (admin uvek; ostali samo na svojim predmetima)
const korisnikImaPredmet = async (email, predmetId) => {
  const moji = await getPredmetiZaAsistenta(email);
  return moji.some((p) => p.id === Number(predmetId));
};

// Dohvatanje SVIH predmeta sa terminima kolokvijuma (za Admina / Profesorke i Excel export)
const getAllTerminiKolokvijuma = async () => {
  return await prisma.predmet.findMany({
    include: {
      terminiKolokvijuma: true,
      profesor: true,
      saradnici: true
    },
    orderBy: [
      { semestar: 'asc' },
      { godina: 'asc' }
    ]
  });
};

// Broj ili null (prazno polje u formi ne sme da postane 0)
const brojIliNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

const poljaTermina = (data) => ({
  k1_datum: data.k1_datum,
  k1_trajanje: brojIliNull(data.k1_trajanje),
  k1_racunarska_sala: Boolean(data.k1_racunarska_sala),
  k1_dezurni: brojIliNull(data.k1_dezurni),

  k2_datum: data.k2_datum,
  k2_trajanje: brojIliNull(data.k2_trajanje),
  k2_racunarska_sala: Boolean(data.k2_racunarska_sala),
  k2_dezurni: brojIliNull(data.k2_dezurni),

  k3_datum: data.k3_datum,
  k3_trajanje: brojIliNull(data.k3_trajanje),
  k3_racunarska_sala: Boolean(data.k3_racunarska_sala),
  k3_dezurni: brojIliNull(data.k3_dezurni),

  popravni_u_terminu_ispita: Boolean(data.popravni_u_terminu_ispita),
  popravni_trajanje: brojIliNull(data.popravni_trajanje),
  popravni_racunarska_sala: Boolean(data.popravni_racunarska_sala),
  popravni_dezurni: brojIliNull(data.popravni_dezurni),

  napomena: data.napomena
});

// Čuvanje ili ažuriranje termina kolokvijuma za konkretan predmet
const upsertTerminiKolokvijuma = async (predmetId, data) => {
  const polja = poljaTermina(data);
  return await prisma.terminKolokvijuma.upsert({
    where: { predmet_id: Number(predmetId) },
    update: polja,
    create: { predmet_id: Number(predmetId), ...polja }
  });
};

module.exports = {
  korisnikImaPredmet,
  getPredmetiZaAsistenta,
  getAllTerminiKolokvijuma,
  upsertTerminiKolokvijuma
};