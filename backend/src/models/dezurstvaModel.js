const prisma = require('../db/prisma');
const { naziviSala } = require('../utils/sale');

// models/dezurstvaModel.js
const getDezurstvaBySaradnikId = async (saradnik_id) => {
    const dezurstva = await prisma.dezurstva.findMany({
        where: { 
            saradnik_id: Number(saradnik_id),
            ispit: {
                is_published: true // asistenti vide samo objavljeno
            }
        },
        include: {
            ispit: {
                include: { predmet: true, sala: true, dodatneSale: true }
            }
        }
    });
    // Termin u više sala: za prikaz su sve sale u jednom nazivu
    dezurstva.forEach((d) => {
        if (d.ispit?.sala && d.ispit.dodatneSale?.length) d.ispit.sala = { ...d.ispit.sala, naziv: naziviSala(d.ispit) };
    });
    return dezurstva;
};

module.exports = { getDezurstvaBySaradnikId };