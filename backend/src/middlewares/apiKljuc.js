const crypto = require('crypto');
const config = require('../config/config');

// Zaštita rute za spoljni sistem (npr. administrator fakulteta): tajni ključ u zaglavlju X-API-Key.
// Poredi se konstantnim vremenom (nad SHA-256 vrednostima), pa se ključ ne može pogađati merenjem odgovora.
// Ključ se čita pri svakom pozivu, pa se promena u .env primenjuje restartom servera.
const sazetak = (v) => crypto.createHash('sha256').update(String(v)).digest();

const apiKljuc = (req, res, next) => {
    const ocekivan = config.integracijaKljuc;
    if (!ocekivan) {
        return res.status(503).json({ error: 'Integracija nije uključena na ovom serveru (INTEGRACIJA_API_KLJUC nije podešen).' });
    }
    const dobijen = req.get('x-api-key');
    if (!dobijen || !crypto.timingSafeEqual(sazetak(dobijen), sazetak(ocekivan))) {
        return res.status(401).json({ error: 'Neispravan ili nedostajući API ključ (zaglavlje X-API-Key).' });
    }
    next();
};

module.exports = { apiKljuc };
