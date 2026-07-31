const prisma = require('../db/prisma');

const getAllIspiti = async () => {
    const result = await prisma.ispit.findMany({
        include: {
            predmet: {
                select: {
                    naziv: true,
                    sifra: true,
                    godina: true,
                    status: true,
                    profesor: true 
                }
            },
            sala: true 
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

const createIspit = async (predmet_id, datum, vreme, is_ispit = true, sala_id = null) => {
    return await prisma.ispit.create({
        data: {
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            is_ispit: Boolean(is_ispit),
            
            // Koristimo connect za bezbedno vezivanje stranog ključa
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined
        }
    });
};

const updateIspit = async (id, predmet_id, datum, vreme, is_ispit, sala_id) => {
    return await prisma.ispit.update({
        where: { id: Number(id) },
        data: {
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            is_ispit: Boolean(is_ispit),
            
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined
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