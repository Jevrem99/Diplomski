const prisma = require('../db/prisma');

const getAllPredmets = async () => {
    const predmeti = await prisma.predmet.findMany({
        include: {
            profesor: {
                select: {
                    ime: true,
                    prezime: true
                }
            }
        }
    });
    return predmeti;
};

const getPredmetById = async (id) => {
    const predmet = await prisma.predmet.findUnique({
        where: { id: Number(id) },
        include: {
            profesor: true
        }
    });
    return predmet;
};

const createPredmet = async (naziv, godina, semestar, status, sifra, profesor_id) => {
    return await prisma.predmet.create({
        data: { naziv, godina, semestar, status, sifra, profesor_id: Number(profesor_id) }
    });
};

const updatePredmet = async (id, naziv, godina, semestar, status, sifra, profesor_id) => {
    return await prisma.predmet.update({
        where: { id: Number(id) },
        data: { naziv, godina, semestar, status, sifra, profesor_id: Number(profesor_id) }
    });
};

const deletePredmet = async (id) => {
    return await prisma.predmet.delete({
        where: { id: Number(id) }
    });
};

module.exports = {
    getAllPredmets,
    getPredmetById,
    createPredmet,
    updatePredmet,
    deletePredmet
};