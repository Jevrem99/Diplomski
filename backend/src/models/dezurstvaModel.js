const prisma = require('../db/prisma');

// models/dezurstvaModel.js
const getDezurstvaBySaradnikId = async (saradnik_id) => {
    return await prisma.dezurstva.findMany({
        where: { 
            saradnik_id: Number(saradnik_id),
            ispit: {
                is_published: true // <--- Asistenti vide samo objavljeno!
            }
        },
        include: {
            ispit: {
                include: { predmet: true, sala: true }
            }
        }
    });
};

module.exports = { getDezurstvaBySaradnikId };