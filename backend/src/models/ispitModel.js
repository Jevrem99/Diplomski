const pool = require('../db/connection');
const config = require('../config/config');

const prisma = require('../db/prisma');

//AKO TREBA DA SE FORMATIRA DATUM I VREME, OVO JE FUNKCIJA KOJA TO RADI, ALI SADA JE NE KORISTIMO JER SMO U PRISMA KONFIGURACIJI DEFINISALI FORMATIRANJE DATUMA I VREMENA
// const formatIspit = (data) => {
//   if (!data) return null;
  
//   if (Array.isArray(data)) {
//     return data.map(item => formatIspit(item));
//   }

//   return {
//     ...data,
//     datum: data.datum ? data.datum.toISOString().split('T')[0] : null,
//     vreme: data.vreme ? data.vreme.toISOString().substring(11, 19) : null
//   };
// };


const getAllIspiti = async () => {
    const result = await prisma.ispit.findMany();
    return result;
}

const getIspitById = async (id) => {
    const result = await prisma.ispit.findUnique({
        where: {
            id: Number(id)
        }
    });
    return result;
}

const createIspit = async (predmet_id, datum, vreme, is_ispit) => {
    const result = await prisma.ispit.create({
        data: {
            predmet_id: predmet_id,
            datum: new Date(datum),
            vreme: new Date(datum + 'T' + vreme +'Z'),
            is_ispit: is_ispit
        }
    });
    return result;
}

const updateIspit = async (id, predmet_id, datum, vreme, is_ispit) => {
    const result = await prisma.ispit.update({
        where: {
            id: Number(id)
        },
        data: {
            predmet_id: predmet_id,
            datum: new Date(datum),
            vreme: new Date(datum + 'T' + vreme +'Z'),
            is_ispit: is_ispit
        }
    });
    return result;
}

const deleteIspit = async (id) => {
    const result = await prisma.ispit.delete({
        where: {
            id: Number(id)
        }
    });
    return result;
}

module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit
};