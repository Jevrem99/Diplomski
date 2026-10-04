const jwt = require('jsonwebtoken');
const config = require('../config/config');
const prisma = require('../db/prisma');

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Niste autorizovani, token nedostaje' });
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = jwt.verify(token, config.secret, { algorithms: ['HS256'] });
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token nije validan ili je istekao' });
    }
};

// Dozvoljava pristup samo navedenim ulogama, npr. restrictTo('admin', 'profesor')
const restrictTo = (...uloge) => (req, res, next) => {
    if (!req.user || !uloge.includes(req.user.uloga)) {
        return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju!' });
    }
    next();
};

const restrictToAdmin = restrictTo('admin');

// Admin sme sve; ostali samo nad sopstvenim zapisima (email profesora === email korisnika).
// getSaradnikId(req) vraća id saradnika na koji se zahtev odnosi (ili Promise koji ga vraća).
const ownerOrStaff = (getSaradnikId) => async (req, res, next) => {
    try {
        if (req.user.uloga === 'admin') return next();
        const saradnikId = Number(await getSaradnikId(req));
        if (!Number.isInteger(saradnikId)) {
            return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju!' });
        }
        const saradnik = await prisma.profesor.findUnique({ where: { id: saradnikId } });
        const mojEmail = String(req.user.email || '').trim().toLowerCase();
        if (saradnik && saradnik.email && saradnik.email.trim().toLowerCase() === mojEmail) return next();
        return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju!' });
    } catch (error) {
        console.error('Greška u ownerOrStaff:', error);
        return res.status(500).json({ message: 'Greška na serveru.' });
    }
};

module.exports = { protect, restrictTo, restrictToAdmin, ownerOrStaff };
