const prisma = require('../db/prisma');

const getAllIspiti = async () => {
    return await prisma.ispit.findMany({
        include: {
            predmet: { include: { profesor: true } },
            sala: true,
            // OBAVEZNO: Povlačimo dežurstva i podatke o saradniku
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

const createIspit = async (predmet_id, datum, vreme, vreme_kraja, is_ispit = true, sala_id = null, dezurni_ids = []) => {
    return await prisma.ispit.create({
        data: {
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            vreme_kraja: vreme_kraja ? new Date(`${datum}T${vreme_kraja}Z`) : null,
            is_ispit: Boolean(is_ispit),
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined,
            // KREIRAMO DEŽURSTVA ODMAH PRI PRVOM UNOSU:
            dezurstva: {
                create: (dezurni_ids || []).map(s_id => ({ saradnik_id: Number(s_id) }))
            }
        }
    });
};

const updateIspit = async (id, predmet_id, datum, vreme, vreme_kraja, is_ispit, sala_id, dezurni_ids = []) => {
    // Proveravamo da li je vreme uopšte poslato i da li je string
    let parsedVreme = null;
    if (vreme) {
        const cistoVreme = vreme.includes('T') ? vreme.substring(11, 19) : (vreme.length === 5 ? `${vreme}:00` : vreme);
        parsedVreme = new Date(`${datum.split('T')[0]}T${cistoVreme}Z`);
    }

    let parsedVremeKraja = null;
    if (vreme_kraja) {
        const cistoVremeKraja = vreme_kraja.includes('T') ? vreme_kraja.substring(11, 19) : (vreme_kraja.length === 5 ? `${vreme_kraja}:00` : vreme_kraja);
        parsedVremeKraja = new Date(`${datum.split('T')[0]}T${cistoVremeKraja}Z`);
    }

    return await prisma.ispit.update({
        where: { id: Number(id) },
        data: {
            datum: new Date(datum),
            vreme: parsedVreme, // Sada je ili validan Date objekat ili null
            vreme_kraja: parsedVremeKraja,
            is_ispit: Boolean(is_ispit),
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined,
            dezurstva: {
                deleteMany: {},
                create: (dezurni_ids || []).map(s_id => ({ saradnik_id: Number(s_id) }))
            }
        }
    });
};
const deleteIspit = async (id) => {
    return await prisma.ispit.delete({
        where: { id: Number(id) }
    });
};

module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit
};