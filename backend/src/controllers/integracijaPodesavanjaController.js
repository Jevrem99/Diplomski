const pod = require('../services/integracijaPodesavanja');
const { ucitajObjavljeneRezervacije } = require('../services/rezervacijeSala');
const { logAction } = require('../services/auditService');

const korisnik = (req) => req.user?.username || 'Administrator';
const greska = (res, err, poruka) => {
    console.error(poruka, err);
    return res.status(500).json({ error: 'Greška na serveru.' });
};

// GET /admin/integracija
const getStanje = async (req, res) => {
    try {
        res.status(200).json(await pod.stanje());
    } catch (err) {
        greska(res, err, 'Greška pri čitanju podešavanja integracije:');
    }
};

// POST /admin/integracija/kljuc: pravi novi ključ i vraća ga JEDNOM (u bazi ostaje samo njegov SHA-256)
const noviKljuc = async (req, res) => {
    try {
        const kljuc = await pod.napraviKljuc();
        await logAction(korisnik(req), 'UPDATE', 'Integracija', 'Napravljen novi API ključ za preuzimanje rezervacija sala');
        res.status(200).json({ kljuc });
    } catch (err) {
        greska(res, err, 'Greška pri pravljenju ključa:');
    }
};

// DELETE /admin/integracija/kljuc: ukloni ključ iz baze (ostaje samo onaj iz .env, ako ga ima)
const ukloniKljuc = async (req, res) => {
    try {
        await pod.ukloniKljucIzBaze();
        await logAction(korisnik(req), 'UPDATE', 'Integracija', 'Uklonjen API ključ iz baze');
        res.status(200).json(await pod.stanje());
    } catch (err) {
        greska(res, err, 'Greška pri uklanjanju ključa:');
    }
};

// PUT /admin/integracija/slanje { url, kljuc? }: adresa na koju se šalje JSON posle objavljivanja ('' = isključeno)
const postaviSlanje = async (req, res) => {
    try {
        const { url, kljuc } = req.body || {};
        const prazno = url === '' || url === null || url === undefined;
        const cistaAdresa = prazno ? '' : String(url).trim();
        if (!prazno && !pod.jeAdresa(cistaAdresa)) {
            return res.status(400).json({ error: 'Adresa mora počinjati sa http:// ili https://.' });
        }
        if (kljuc !== undefined && (typeof kljuc !== 'string' || kljuc.length > 200)) {
            return res.status(400).json({ error: 'Ključ za slanje je predugačak.' });
        }
        await pod.postaviSlanje({ url: cistaAdresa, kljuc });
        await logAction(korisnik(req), 'UPDATE', 'Integracija', prazno ? 'Isključeno slanje JSON-a' : 'Podešena adresa za slanje JSON-a');
        res.status(200).json(await pod.stanje());
    } catch (err) {
        greska(res, err, 'Greška pri čuvanju adrese za slanje:');
    }
};

// POST /admin/integracija/slanje/proba: šalje trenutne rezervacije na podešenu adresu
const probnoSlanje = async (req, res) => {
    try {
        const danas = new Date().toISOString().substring(0, 10);
        const rez = await ucitajObjavljeneRezervacije({ od: danas, objavio: korisnik(req) });
        const ishod = await pod.posaljiRezervacije(rez);
        if (!ishod.ukljuceno) return res.status(400).json({ error: 'Adresa za slanje nije podešena.' });
        res.status(200).json({ ...ishod, broj: rez.rezervacije.length });
    } catch (err) {
        greska(res, err, 'Greška pri probnom slanju:');
    }
};

module.exports = { getStanje, noviKljuc, ukloniKljuc, postaviSlanje, probnoSlanje };
