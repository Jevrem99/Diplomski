const prisma = require('../db/prisma');

const logAction = async (korisnik, akcija, entitet, detalji = '') => {
    try {
        await prisma.auditLog.create({
            data: {
                korisnik: korisnik || 'Sistem',
                akcija: akcija.toUpperCase(),
                entitet,
                detalji
            }
        });
    } catch (err) {
        console.error('Greška pri upisu u audit log:', err.message);
    }
};

const getRecentLogs = async (limit = 100) => {
    return await prisma.auditLog.findMany({
        take: limit,
        orderBy: { created_at: 'desc' }
    });
};

module.exports = { logAction, getRecentLogs };