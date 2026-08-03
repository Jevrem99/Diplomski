const prisma = require('../db/prisma');

const getObavezeBySaradnikId = async (saradnik_id) => {
  // Ako postoji saradnik_id filtriramo po njemu, ako je undefined (prosledjeno /obaveze) vracamo SVE
  const whereCondition = saradnik_id ? { saradnik_id: Number(saradnik_id) } : {};
  
  return await prisma.obaveza.findMany({
    where: whereCondition,
    orderBy: {
      datum: "asc"
    }
  });
};

const createObaveza = async (saradnik_id, datum, datum_do, vreme_pocetka, vreme_kraja, tip_obaveze) => {
  return await prisma.obaveza.create({
    data: {
      saradnik_id: Number(saradnik_id),
      datum: new Date(datum),
      datum_do: datum_do ? new Date(datum_do) : null,
      vreme_pocetka: vreme_pocetka ? new Date(`${datum}T${vreme_pocetka}Z`) : null,
      vreme_kraja: vreme_kraja ? new Date(`${datum}T${vreme_kraja}Z`) : null,
      tip_obaveze: tip_obaveze || 'Nedostupan/na'
    }
  });
};

const deleteObaveza = async (id) => {
  return await prisma.obaveza.delete({ where: { id: Number(id) } });
};

module.exports = { getObavezeBySaradnikId, createObaveza, deleteObaveza };