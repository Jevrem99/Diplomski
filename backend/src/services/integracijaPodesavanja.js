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
            headers: { 'Content-Type': 'application/json', ...(kljuc ? { 'X-API-Key': kljuc } : {}) }
        });
        const ok = r.status >= 200 && r.status < 300;
        return { ukljuceno: true, poslato: ok, status: r.status, greska: ok ? null : `Server je odgovorio sa ${r.status}` };
    } catch (err) {
        return { ukljuceno: true, poslato: false, status: null, greska: err.code || err.message };
    }
};

module.exports = {
    ocekivaniKljuc, napraviKljuc, ukloniKljucIzBaze, stanje, postaviSlanje, posaljiRezervacije, jeAdresa, sazetakHex
};
