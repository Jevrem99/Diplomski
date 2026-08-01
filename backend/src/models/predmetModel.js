const prisma = require('../db/prisma');

const getAllPredmets = async () => {
    return await prisma.predmet.findMany({
        include: {
            profesor: true, // Glavni profesor
            saradnici: {    // Asistenti na predmetu
                include: {
                    obaveze: true, // Fiksni nedeljni raspored
                    dezurstva: {   // Već zakazani ispiti
                        include: { ispit: true }
                    }
                }
            }
        }
    });
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

const createPredmet = async (sifra, naziv, godina, semestar, status, broj_studenata, profesor_id, saradnici_ids = []) => {
    return await prisma.predmet.create({
        data: {
            sifra,
            naziv,
            godina: Number(godina),
            semestar: String(semestar),
            status: String(status),
            broj_studenata: Number(broj_studenata || 0),
            profesor: profesor_id ? { connect: { id: Number(profesor_id) } } : undefined,
            saradnici: {
                connect: (saradnici_ids || []).map(id => ({ id: Number(id) }))
            }
        }
    });
};

const updatePredmet = async (id, sifra, naziv, godina, semestar, status, broj_studenata, profesor_id, saradnici_ids = []) => {
    return await prisma.predmet.update({
        where: { id: Number(id) },
        data: {
            sifra,
            naziv,
            godina: Number(godina),
            semestar: String(semestar),
            status: String(status),
            broj_studenata: Number(broj_studenata || 0),
            profesor: profesor_id ? { connect: { id: Number(profesor_id) } } : undefined,
            saradnici: {
                set: [],
                connect: (saradnici_ids || []).map(id => ({ id: Number(id) }))
            }
        }
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