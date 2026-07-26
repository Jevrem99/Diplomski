const pool = require('../db/connection');
const config = require('../config/config');

const prisma = require('../db/prisma');

const getAllProfesors = async () => {
    const result = await prisma.profesor.findMany();
    return result;
}

const getProfesorById = async (id) => {
    const result = await prisma.profesor.findUnique({
        where: {
            id: Number(id)
        }
    });
    return result;
}

//is_saradnik mozda nepotreban ako se na frotnu dodavanje profesora i saradnika odvaja
const createProfesor = async (ime, prezime, is_saradnik, email) => {
    const result = await prisma.profesor.create({
        data: {
            ime: ime,
            prezime: prezime,
            is_saradnik: Boolean(is_saradnik),
            email: email
        }
    });
    return result;
}

//is_saradnik mozda nepotreban ako se na frotnu dodavanje profesora i saradnika odvaja
const updateProfesor = async (id, ime, prezime, is_saradnik, email) => {
    const result = await prisma.profesor.update({
        where: {
            id: Number(id)
        },
        data: {
            ime: ime,
            prezime: prezime,
            is_saradnik: Boolean(is_saradnik),
            email: email
        }
    });
    return result;
}

const deleteProfesor = async (id) => {
    const result = await prisma.profesor.delete({
        where: {
            id: Number(id)
        }
    });
    return result;
}

module.exports = {
    getAllProfesors,
    getProfesorById,
    createProfesor,
    updateProfesor,
    deleteProfesor
};