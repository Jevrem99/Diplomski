const pool = require('../db/connection');
const config = require('../config/config');

const prisma = require('../db/prisma');

const getAllPredmets = async () => {
    const predmeti = await prisma.predmet.findMany();
    return predmeti;
}

const getPredmetById = async (id) => {
    const predmet = await prisma.predmet.findUnique({
        where: {
            id: Number(id)
        }
    });
    return predmet;
}

// Predmet (id, naziv, godina, semestar, status, sifra, profesor_id)
const createPredmet = async (naziv, godina, semestar, status, sifra, profesor_id) => {
    const predmet = await prisma.predmet.create({
        data: {
            naziv: naziv,
            godina: godina,
            semestar: semestar,
            status: status,
            sifra: sifra,
            profesor_id: profesor_id
        }
    });
    return predmet;
}

const updatePredmet = async (id, naziv, godina, semestar, status, sifra, profesor_id) => {
    const predmet = await prisma.predmet.update({
        where: {
            id: Number(id)
        },
        data: {
            naziv: naziv,
            godina: godina,
            semestar: semestar,
            status: status,
            sifra: sifra,
            profesor_id: profesor_id
        }
    });
    return predmet;
}

const deletePredmet = async (id) => {
    const predmet = await prisma.predmet.delete({
        where: {
            id: Number(id)
        }
    });
    return predmet;
}

module.exports = {
    getAllPredmets,
    getPredmetById,
    createPredmet,
    updatePredmet,
    deletePredmet
};