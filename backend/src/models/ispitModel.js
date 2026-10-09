const prisma = require('../db/prisma');

const getAllIspiti = async (where = {}) => {
    return await prisma.ispit.findMany({
        where,
        orderBy: [{ datum: 'asc' }, { vreme: 'asc' }],
        include: {
            predmet: { include: { profesor: true } },
            sala: true,
            dezurstva: {
                include: {
                    saradnik: true
                }
            }
        }
    });
};

const getIspitById = async (id) => {
    return await prisma.ispit.findUnique({
        where: { id: Number(id) },
        include: { predmet: true }
    });
};

// db = prisma ili transakcioni klijent (tx) kad se poziva unutar prisma.$transaction
const createIspit = async (predmet_id, datum, vreme, vreme_kraja, is_ispit = true, tip_kolokvijuma = 'I', sala_id = null, dezurni_ids = [], db = prisma, grupa_kljuc = null) => {
    // 1. Kreiraj samo ispit (bez ugnježdenog dezurstva)
    const noviIspit = await db.ispit.create({
        data: {
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            vreme_kraja: vreme_kraja ? new Date(`${datum}T${vreme_kraja}Z`) : null,
            is_ispit: Boolean(is_ispit),
            tip_kolokvijuma: tip_kolokvijuma || 'I',
            grupa_kljuc: grupa_kljuc || null,
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined
        }
    });

    // 2. Kreiraj dežurstva kao odvojen upit
    if (dezurni_ids && dezurni_ids.length > 0) {
        await db.dezurstva.createMany({
            data: dezurni_ids.map(s_id => ({
                ispit_id: noviIspit.id,
                saradnik_id: Number(s_id)
            }))
        });
    }

    // 3. Vrati kompletan ispit da format ostane isti za frontend
    return await db.ispit.findUnique({
        where: { id: noviIspit.id },
        include: { predmet: true, sala: true, dezurstva: true }
    });
};

const updateIspit = async (
    id,
    predmet_id,
    datum,
    vreme,
    vreme_kraja,
    is_ispit = true,
    tip_kolokvijuma = 'I',
    sala_id = null,
    dezurni_ids = []
) => {
    const numericId = Number(id);
    if (isNaN(numericId)) {
        throw new Error(`Nevalidan ID ispita: ${id}`);
    }

    if (!datum || isNaN(new Date(datum).getTime())) {
        throw new Error(`Nevalidan datum: ${datum}`);
    }
    const dateStr = new Date(datum).toISOString().split('T')[0];

    let parsedVreme = null;
    if (vreme) {
        const cistoVreme = vreme.includes('T') ? vreme.substring(11, 16) : vreme.substring(0, 5);
        parsedVreme = new Date(`${dateStr}T${cistoVreme}:00Z`);
    }

    let parsedVremeKraja = null;
    if (vreme_kraja) {
        const cistoVremeKraja = vreme_kraja.includes('T') ? vreme_kraja.substring(11, 16) : vreme_kraja.substring(0, 5);
        parsedVremeKraja = new Date(`${dateStr}T${cistoVremeKraja}:00Z`);
    }

    // 1. Obriši stara dežurstva zasebnim upitom
    await prisma.dezurstva.deleteMany({
        where: { ispit_id: numericId }
    });

    // 2. Ažuriraj ispit bez ugnježdenog dezurstva
    await prisma.ispit.update({
        where: { id: numericId },
        data: {
            predmet: { connect: { id: Number(predmet_id) } },
            datum: new Date(dateStr),
            vreme: parsedVreme,
            vreme_kraja: parsedVremeKraja,
            is_ispit: Boolean(is_ispit),
            tip_kolokvijuma: String(tip_kolokvijuma || 'I'),
            sala: sala_id ? { connect: { id: Number(sala_id) } } : { disconnect: true },
            is_published: false,
            is_izmenjen: true
        }
    });

    // 3. Dodaj nova dežurstva
    if (dezurni_ids && dezurni_ids.length > 0) {
        await prisma.dezurstva.createMany({
            data: dezurni_ids.map(dId => ({
                ispit_id: numericId,
                saradnik_id: Number(dId)
            }))
        });
    }

    return await prisma.ispit.findUnique({
        where: { id: numericId },
        include: { predmet: true, sala: true, dezurstva: true }
    });
};

const deleteIspit = async (id) => {
  return await prisma.ispit.deleteMany({
    where: {
      id: Number(id)
    }
  });
};

module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit
};