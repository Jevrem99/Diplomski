const { PrismaClient } = require('@prisma/client');
const prisma = require('../db/prisma');

// Dohvatanje predmeta na kojima je angažovan određeni profesor/asistent preko email-a
const getPredmetiZaAsistenta = async (email) => {
  const profesor = await prisma.profesor.findFirst({
    where: { email: email },
    include: {
      angazovanja: {
        include: {
          terminiKolokvijuma: true
        }
      }
    }
  });
  return profesor ? profesor.angazovanja : [];
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

// Čuvanje ili ažuriranje termina kolokvijuma za konkretan predmet
const upsertTerminiKolokvijuma = async (predmetId, data) => {
  return await prisma.terminKolokvijuma.upsert({
    where: { predmet_id: Number(predmetId) },
    update: {
      k1_datum: data.k1_datum,
      k1_trajanje: data.k1_trajanje ? Number(data.k1_trajanje) : null,
      k1_racunarska_sala: Boolean(data.k1_racunarska_sala),

      k2_datum: data.k2_datum,
      k2_trajanje: data.k2_trajanje ? Number(data.k2_trajanje) : null,
      k2_racunarska_sala: Boolean(data.k2_racunarska_sala),

      k3_datum: data.k3_datum,
      k3_trajanje: data.k3_trajanje ? Number(data.k3_trajanje) : null,
      k3_racunarska_sala: Boolean(data.k3_racunarska_sala),

      popravni_u_terminu_ispita: Boolean(data.popravni_u_terminu_ispita),
      popravni_trajanje: data.popravni_trajanje ? Number(data.popravni_trajanje) : null,
      popravni_racunarska_sala: Boolean(data.popravni_racunarska_sala),

      napomena: data.napomena
    },
    create: {
      predmet_id: Number(predmetId),
      k1_datum: data.k1_datum,
      k1_trajanje: data.k1_trajanje ? Number(data.k1_trajanje) : null,
      k1_racunarska_sala: Boolean(data.k1_racunarska_sala),

      k2_datum: data.k2_datum,
      k2_trajanje: data.k2_trajanje ? Number(data.k2_trajanje) : null,
      k2_racunarska_sala: Boolean(data.k2_racunarska_sala),

      k3_datum: data.k3_datum,
      k3_trajanje: data.k3_trajanje ? Number(data.k3_trajanje) : null,
      k3_racunarska_sala: Boolean(data.k3_racunarska_sala),

      popravni_u_terminu_ispita: Boolean(data.popravni_u_terminu_ispita),
      popravni_trajanje: data.popravni_trajanje ? Number(data.popravni_trajanje) : null,
      popravni_racunarska_sala: Boolean(data.popravni_racunarska_sala),

      napomena: data.napomena
    }
  });
};

module.exports = {
  getPredmetiZaAsistenta,
  getAllTerminiKolokvijuma,
  upsertTerminiKolokvijuma
};