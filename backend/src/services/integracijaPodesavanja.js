const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const config = require('../config/config');

// Podešavanja integracije sa sistemom fakulteta (menjaju se u aplikaciji, bez restarta servera):
//  - ključ kojim sistem fakulteta preuzima rezervacije (u bazi se čuva samo njegov SHA-256, ne i sam ključ)
//  - adresa sistema fakulteta za rezervaciju sala (POST), lozinka koju taj sistem traži i IMI nalog koji rezerviše
// Ključ iz baze ima prednost nad INTEGRACIJA_API_KLJUC iz .env.
const K_HASH = 'integracija_kljuc_hash';
const K_POST_URL = 'integracija_post_url';
const K_POST_KLJUC = 'integracija_post_kljuc';        // lozinka za rezervacije (polje "password" u zahtevu)
const K_POST_USERNAME = 'integracija_post_username';  // IMI korisnik u čije ime se rezerviše (prazno = ko objavljuje)

const sazetakHex = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

const procitaj = async (kljuc) => {
    const red = await prisma.podesavanje.findUnique({ where: { kljuc } });
    return red ? red.vrednost : null;
};
const upisi = (kljuc, vrednost) =>
    prisma.podesavanje.upsert({ where: { kljuc }, create: { kljuc, vrednost }, update: { vrednost } });
const obrisi = (kljuc) => prisma.podesavanje.deleteMany({ where: { kljuc } });

// SHA-256 (hex) ključa koji važi sada i odakle dolazi; hash je null kad ključ nije podešen
const ocekivaniKljuc = async () => {
    const izBaze = await procitaj(K_HASH);
    if (izBaze) return { hash: izBaze, izvor: 'baza' };
    if (config.integracijaKljuc) return { hash: sazetakHex(config.integracijaKljuc), izvor: 'env' };
    return { hash: null, izvor: null };
};

// Novi ključ (prikazuje se samo jednom); stari odmah prestaje da važi
const napraviKljuc = async () => {
    const kljuc = crypto.randomBytes(32).toString('hex');
    await upisi(K_HASH, sazetakHex(kljuc));
    return kljuc;
};
const ukloniKljucIzBaze = () => obrisi(K_HASH);

const jeAdresa = (v) => {
    if (typeof v !== 'string' || v.length > 500) return false;
    try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

const stanje = async () => {
    const { izvor } = await ocekivaniKljuc();
    return {
        kljucPodesen: izvor !== null,
        kljucIzvor: izvor,
        postUrl: await procitaj(K_POST_URL),
        postKljucPodesen: Boolean(await procitaj(K_POST_KLJUC)),
        postUsername: await procitaj(K_POST_USERNAME)
    };
};

// url === '': isključi slanje; kljuc i username: undefined = ne menjaj, '' = obriši
const postaviSlanje = async ({ url, kljuc, username }) => {
    if (url === '') {
        await obrisi(K_POST_URL);
        await obrisi(K_POST_KLJUC);
        await obrisi(K_POST_USERNAME);
        return;
    }
    await upisi(K_POST_URL, url);
    if (kljuc === '') await obrisi(K_POST_KLJUC);
    else if (typeof kljuc === 'string') await upisi(K_POST_KLJUC, kljuc);
    if (username === '') await obrisi(K_POST_USERNAME);
    else if (typeof username === 'string') await upisi(K_POST_USERNAME, username.trim());
};

const podesavanjaSlanja = async () => ({
    url: await procitaj(K_POST_URL),
    lozinka: await procitaj(K_POST_KLJUC),
    username: await procitaj(K_POST_USERNAME)
});

// Odgovor sistema fakulteta: uspeh je JSON sa "status": "uspeh" (ili "ok"); svaki drugi odgovor je greška
// i njegova poruka (npr. "Termin je zauzet.") se vraća da je administrator vidi.
const oceniOdgovor = (httpStatus, telo) => {
    let j = telo;
    if (typeof telo === 'string') {
        try { j = JSON.parse(telo); } catch { j = null; }
    }
    if (httpStatus >= 200 && httpStatus < 300 && j && typeof j === 'object' && ['ok', 'uspeh'].includes(String(j.status).toLowerCase())) {
        return { poslato: true, greska: null, idRezervacije: j.idRezervacije ?? null };
    }
    // Poruka primaoca (npr. da rezervacija već postoji) se prikazuje; sirov odgovor (HTML, eho) ide samo u dnevnik servera
    const poruka = j && typeof j === 'object' ? (j.poruka || j.message || j.error || j.greska || j.opis || null) : null;
    if (!poruka) console.warn(`[slanje rezervacija] odgovor bez {"status":"ok"} (HTTP ${httpStatus}):`, String(telo ?? '').replace(/\s+/g, ' ').slice(0, 300));
    if (httpStatus >= 400) return { poslato: false, greska: `Server fakulteta je vratio grešku (HTTP ${httpStatus})${poruka ? `: ${String(poruka).slice(0, 300)}` : '.'}` };
    return { poslato: false, greska: poruka ? String(poruka).slice(0, 300) : 'Server fakulteta nije potvrdio rezervaciju.' };
};

const adresaSlanja = () => procitaj(K_POST_URL);

// Šalje JSON na adresu sistema fakulteta. Nikad ne baca grešku: objavljivanje ne sme da zavisi od tuđeg servera.
// Vraća { httpStatus, telo } ili { greska } kad server nije dostupan.
const posaljiJson = async (telo) => {
    const url = await procitaj(K_POST_URL);
    if (!url) return { greska: 'Adresa za slanje nije podešena.' };
    try {
        const r = await axios.post(url, telo, {
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: () => true,
            responseType: 'text',
            transformResponse: (x) => x,
            headers: { 'Content-Type': 'application/json' }
        });
        return { httpStatus: r.status, telo: r.data };
    } catch (err) {
        return { greska: `Sistem fakulteta nije dostupan (${err.code || err.message}).` };
    }
};

module.exports = {
    oceniOdgovor, adresaSlanja, podesavanjaSlanja, posaljiJson, ocekivaniKljuc, napraviKljuc, ukloniKljucIzBaze, stanje, postaviSlanje, jeAdresa, sazetakHex
};
