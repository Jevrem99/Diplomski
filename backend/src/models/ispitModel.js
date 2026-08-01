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

const createIspit = async (predmet_id, datum, vreme, vreme_kraja, is_ispit = true, sala_id = null) => {
    return await prisma.ispit.create({
        data: {
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            // Čuvamo i vreme kraja
            vreme_kraja: vreme_kraja ? new Date(`${datum}T${vreme_kraja}Z`) : null,
            is_ispit: Boolean(is_ispit),
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined
        }
    });
};

const updateIspit = async (id, predmet_id, datum, vreme, vreme_kraja, is_ispit, sala_id, dezurni_ids = []) => {
    return await prisma.ispit.update({
        where: { id: Number(id) },
        data: {
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            vreme_kraja: vreme_kraja ? new Date(`${datum}T${vreme_kraja}Z`) : null,
            is_ispit: Boolean(is_ispit),
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined,
            dezurstva: {
                deleteMany: {},
                create: dezurni_ids.map(s_id => ({ saradnik_id: Number(s_id) }))
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