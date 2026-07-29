const prisma = require('../db/prisma');

const getAllIspiti = async () => {
    const result = await prisma.ispit.findMany({
        include: {
            predmet: {
                select: {
                    naziv: true,
                    sifra: true,
                    godina: true,
                    status: true
                }
            }
        }
    });
    return result;
};

const getIspitById = async (id) => {
    return await prisma.ispit.findUnique({
        where: { id: Number(id) },
        include: { predmet: true }
    });
};

const createIspit = async (predmet_id, datum, vreme, is_ispit = true, sala = null) => {
    return await prisma.ispit.create({
        data: {
            predmet_id: Number(predmet_id),
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            is_ispit: Boolean(is_ispit),
            sala: sala
        }
    });
};

const updateIspit = async (id, predmet_id, datum, vreme, is_ispit, sala) => {
    return await prisma.ispit.update({
        where: { id: Number(id) },
        data: {
            predmet_id: Number(predmet_id),
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            is_ispit: Boolean(is_ispit),
            sala: sala
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