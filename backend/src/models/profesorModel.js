const pool = require('../db/connection');
const config = require('../config/config');

const prisma = require('../db/prisma');

const getAllPredavaci = async () => {
    const result = await prisma.profesor.findMany();
    return result;
}

const getAllProfesori = async () => {
    const result = await prisma.profesor.findMany({
        where: {
            is_saradnik: false
        }
    });
    return result;
}

const getAllSaradnici = async () => {
    const result = await prisma.profesor.findMany({
        where: {
            is_saradnik: true
        }
    });
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
    getAllPredavaci,
    getAllSaradnici,
    getAllProfesori,
    getProfesorById,
    createProfesor,
    updateProfesor,
    deleteProfesor
};