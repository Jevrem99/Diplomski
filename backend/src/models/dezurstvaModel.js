const prisma = require('../db/prisma');

const getDezurstvaBySaradnikId = async (saradnik_id) => {
    return await prisma.dezurstva.findMany({
        where: { saradnik_id: Number(saradnik_id) },
        include: {
            ispit: {
                include: {
                    predmet: true,
                    sala: true
                }
            }
        }
    });
};

module.exports = { getDezurstvaBySaradnikId };