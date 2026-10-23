const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const config = require('../config/config');

// Podešavanja integracije sa sistemom fakulteta (menjaju se u aplikaciji, bez restarta servera):
//  - ključ kojim sistem fakulteta preuzima rezervacije (u bazi se čuva samo njegov SHA-256, ne i sam ključ)
//  - opciona adresa na koju aplikacija sama šalje JSON posle objavljivanja (POST), i opcioni ključ za tu adresu
// Ključ iz baze ima prednost nad INTEGRACIJA_API_KLJUC iz .env.
const K_HASH = 'integracija_kljuc_hash';
const K_POST_URL = 'integracija_post_url';
const K_POST_KLJUC = 'integracija_post_kljuc';

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
        postKljucPodesen: Boolean(await procitaj(K_POST_KLJUC))
    };
};

// url === '': isključi slanje; kljuc: undefined = ne menjaj, '' = obriši
const postaviSlanje = async ({ url, kljuc }) => {
    if (url === '') {
        await obrisi(K_POST_URL);
        await obrisi(K_POST_KLJUC);
        return;
    }
    await upisi(K_POST_URL, url);
    if (kljuc === '') await obrisi(K_POST_KLJUC);
    else if (typeof kljuc === 'string') await upisi(K_POST_KLJUC, kljuc);
};

// Odgovor primaoca: rezervacija je prošla samo ako je telo JSON {"status":"ok"}; svaki drugi odgovor je greška
// i njegov tekst (npr. poruka da rezervacija već postoji) se vraća da ga administrator vidi.
const oceniOdgovor = (httpStatus, telo) => {
    let j = telo;
    if (typeof telo === 'string') {
        try { j = JSON.parse(telo); } catch { j = null; }
    }
    if (httpStatus >= 200 && httpStatus < 300 && j && typeof j === 'object' && String(j.status).toLowerCase() === 'ok') {
        return { poslato: true, greska: null };
    }
    const opis = j && typeof j === 'object'
        ? (j.poruka || j.message || j.error || j.greska || j.opis || JSON.stringify(j))
        : String(telo ?? '').replace(/\s+/g, ' ').trim();
    const skraceno = String(opis).slice(0, 300);
    return { poslato: false, greska: httpStatus >= 400 ? `Server je odgovorio sa ${httpStatus}: ${skraceno}` : `Odgovor nije {"status":"ok"}: ${skraceno}` };
};

// Šalje JSON rezervacija na podešenu adresu. Nikad ne baca grešku: objavljivanje ne sme da zavisi od tuđeg servera.
const posaljiRezervacije = async (rezervacije) => {
    const url = await procitaj(K_POST_URL);
    if (!url) return { ukljuceno: false, poslato: false, status: null, greska: null };
    const kljuc = await procitaj(K_POST_KLJUC);
    try {
        const r = await axios.post(url, rezervacije, {
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: () => true,
            responseType: 'text',
            transformResponse: (x) => x,
            headers: { 'Content-Type': 'application/json', ...(kljuc ? { 'X-API-Key': kljuc } : {}) }
        });
        return { ukljuceno: true, status: r.status, ...oceniOdgovor(r.status, r.data) };
    } catch (err) {
        return { ukljuceno: true, poslato: false, status: null, greska: err.code || err.message };
    }
};

module.exports = {
    oceniOdgovor, ocekivaniKljuc, napraviKljuc, ukloniKljucIzBaze, stanje, postaviSlanje, posaljiRezervacije, jeAdresa, sazetakHex
};
