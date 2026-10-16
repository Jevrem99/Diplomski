const crypto = require('crypto');
const { ocekivaniKljuc } = require('../services/integracijaPodesavanja');

// Zaštita rute za spoljni sistem (npr. administrator fakulteta): tajni ključ u zaglavlju X-API-Key.
// Poredi se konstantnim vremenom (nad SHA-256 vrednostima), pa se ključ ne može pogađati merenjem odgovora.
// Ključ važi iz baze (menja se u Podešavanjima) ili, ako tamo nije postavljen, iz INTEGRACIJA_API_KLJUC u .env.
const sazetak = (v) => crypto.createHash('sha256').update(String(v)).digest();

const napraviApiKljuc = (dohvatiOcekivani = ocekivaniKljuc) => async (req, res, next) => {
    let hash;
    try {
        ({ hash } = await dohvatiOcekivani());
    } catch (err) {
        console.error('Greška pri čitanju API ključa:', err);
        return res.status(500).json({ error: 'Greška na serveru.' });
    }
    if (!hash) {
        return res.status(503).json({ error: 'Integracija nije uključena na ovom serveru (API ključ nije podešen).' });
    }
    const dobijen = req.get('x-api-key');
    if (!dobijen || !crypto.timingSafeEqual(sazetak(dobijen), Buffer.from(hash, 'hex'))) {
        return res.status(401).json({ error: 'Neispravan ili nedostajući API ključ (zaglavlje X-API-Key).' });
    }
    next();
};

module.exports = { apiKljuc: napraviApiKljuc(), napraviApiKljuc };
