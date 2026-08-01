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
const createProfesor = async (ime, prezime, email, is_saradnik = false) => { // <--- DRUGAČIJI REDOSLED!
  return await prisma.profesor.create({
    data: {
      ime: String(ime).trim(),
      prezime: String(prezime).trim(),
      email: String(email).trim(),
      is_saradnik: Boolean(is_saradnik)
    }
  });
}

const updateProfesor = async (id, ime, prezime, email) => {
    return await prisma.profesor.update({
        where: { id: Number(id) },
        data: {
            ime: String(ime).trim(),
            prezime: String(prezime).trim(),
            email: String(email).trim()
        }
    });
};

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