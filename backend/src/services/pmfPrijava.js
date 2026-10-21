const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const config = require('../config/config');
const prisma = require('../db/prisma');
const userModel = require('../models/userModel');

// Prijava preko PMF (IMI) naloga.
// Tok: korisnik se prijavi na IMI -> IMI ga vrati na našu stranicu /auth/callback?token=...
//      -> naš server pita IMI da li je token ispravan i čiji je (verify_token.php) -> mi izdajemo svoju sesiju.
// Pravila: uloga NIKAD ne dolazi od IMI-ja. Poznata osoba dobija ulogu iz naše baze; nova osoba (IMI je potvrdio
// nalog, a e-mail nije kod nas) dobija nalog asistenta i ulazi u spisak saradnika. Admin kasnije menja ulogu.

class PmfGreska extends Error {
    constructor(kod, poruka, status) {
        super(poruka);
        this.kod = kod;
        this.poruka = poruka;
        this.status = status;
    }
}

// Token od IMI-ja (u primeru 64 heksadecimalna znaka); prihvatamo i drugu dužinu, ali samo bezbedne znakove
const TOKEN_OBLIK = /^[A-Za-z0-9_-]{16,256}$/;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Autentifikacija nikad ne prelazi na nesigurnu vezu sama od sebe (za razliku od preuzimanja podataka o salama)
const agent = new https.Agent({ rejectUnauthorized: process.env.PMF_INSECURE_TLS !== 'true' });

// Odgovor IMI-ja može biti objekat ili tekst sa JSON-om; e-mail tražimo u poznatim poljima, pa bilo gde u objektu.
const KLJUCEVI_EMAILA = /^(e[-_ ]?mail|mail|email_adresa|korisnik_email|upn)$/i;
const nadjiEmail = (v, dubina = 0) => {
    if (dubina > 4 || v === null || v === undefined) return null;
    if (typeof v === 'string') return EMAIL.test(v.trim()) ? v.trim() : null;
    if (Array.isArray(v)) {
        for (const x of v) { const e = nadjiEmail(x, dubina + 1); if (e) return e; }
        return null;
    }
    if (typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
            if (KLJUCEVI_EMAILA.test(k) && typeof x === 'string' && EMAIL.test(x.trim())) return x.trim();
        }
        for (const x of Object.values(v)) { const e = nadjiEmail(x, dubina + 1); if (e) return e; }
    }
    return null;
};

// Ako odgovor nema e-mail: korisničko ime iz poznatih polja (npr. "luka.vuksanovic")
const KLJUCEVI_IMENA = /^(username|user_name|korisnicko_ime|korisnik|login|uid|user)$/i;
const nadjiKorisnickoIme = (v, dubina = 0) => {
    if (dubina > 4 || !v || typeof v !== 'object') return null;
    for (const [k, x] of Object.entries(v)) {
        if (KLJUCEVI_IMENA.test(k) && typeof x === 'string' && /^[A-Za-z0-9._-]{2,64}$/.test(x.trim())) return x.trim();
    }
    for (const x of Object.values(v)) { const r = nadjiKorisnickoIme(x, dubina + 1); if (r) return r; }
    return null;
};

// Ime i prezime iz odgovora (za novi nalog), ako ih IMI šalje
const IME = /^(ime|first_?name|given_?name|firstname)$/i;
const PREZIME = /^(prezime|last_?name|family_?name|surname|lastname)$/i;
const PUNO_IME = /^(ime_prezime|imeprezime|full_?name|name|naziv|display_?name)$/i;
const nadjiImePrezime = (v, dubina = 0) => {
    if (dubina > 4 || !v || typeof v !== 'object' || Array.isArray(v)) return null;
    let ime = null; let prezime = null; let puno = null;
    for (const [k, x] of Object.entries(v)) {
        if (typeof x !== 'string' || !x.trim()) continue;
        if (IME.test(k)) ime = x.trim();
        else if (PREZIME.test(k)) prezime = x.trim();
        else if (PUNO_IME.test(k)) puno = x.trim();
    }
    if (ime || prezime) return { ime: ime || '', prezime: prezime || '' };
    if (puno) { const [a, ...b] = puno.split(/\s+/); return { ime: a, prezime: b.join(' ') }; }
    for (const x of Object.values(v)) { const r = nadjiImePrezime(x, dubina + 1); if (r) return r; }
    return null;
};

// Opis oblika odgovora za dnevnik servera: samo imena polja, bez vrednosti
const oblik = (v, dubina = 0) => {
    if (v === null || typeof v !== 'object') return typeof v;
    if (dubina > 2) return '{…}';
    if (Array.isArray(v)) return `[${v.length ? oblik(v[0], dubina + 1) : ''}]`;
    return `{${Object.entries(v).map(([k, x]) => `${k}:${oblik(x, dubina + 1)}`).join(', ')}}`;
};

const javljaGresku = (podaci) => {
    if (!podaci || typeof podaci !== 'object' || Array.isArray(podaci)) return false;
    if (podaci.error || podaci.greska || podaci.success === false || podaci.valid === false) return true;
    const st = String(podaci.status ?? '').toLowerCase();
    return ['error', 'fail', 'failed', 'invalid', 'nevalidan', 'greska'].includes(st);
};

const NEDOSTUPAN = 'PMF sistem za prijavu trenutno nije dostupan. Pokušajte ponovo kasnije.';
const NEVAZECI = 'Prijava preko PMF naloga nije uspela ili je istekla. Pokušajte ponovo.';

// Vraća { email } ili baca PmfGreska
const proveriToken = async (token) => {
    if (typeof token !== 'string' || !TOKEN_OBLIK.test(token)) {
        throw new PmfGreska('TOKEN_OBLIK', 'Neispravan token za prijavu.', 400);
    }
    let odgovor;
    try {
        odgovor = await axios.get(config.pmfVerifyUrl, {
            params: { token },
            timeout: 10000,
            httpsAgent: agent,
            responseType: 'text',
            transformResponse: (x) => x,
            validateStatus: () => true
        });
    } catch (err) {
        console.error('[PMF prijava] IMI nedostupan:', err.code || err.message);
        throw new PmfGreska('PMF_NEDOSTUPAN', NEDOSTUPAN, 502);
    }
    if (odgovor.status >= 500) throw new PmfGreska('PMF_NEDOSTUPAN', NEDOSTUPAN, 502);
    if (odgovor.status >= 400) throw new PmfGreska('TOKEN_NEVAZECI', NEVAZECI, 401);

    let podaci = odgovor.data;
    if (typeof podaci === 'string') {
        try { podaci = JSON.parse(podaci); } catch { podaci = null; }
    }
    if (javljaGresku(podaci)) throw new PmfGreska('TOKEN_NEVAZECI', NEVAZECI, 401);
    console.log('[PMF prijava] oblik odgovora:', oblik(podaci));
    const email = nadjiEmail(podaci);
    const imePrezime = nadjiImePrezime(podaci);
    if (email) return { email: email.toLowerCase(), korisnickoIme: nadjiKorisnickoIme(podaci), imePrezime };
    const korisnickoIme = nadjiKorisnickoIme(podaci);
    if (korisnickoIme) return { email: null, korisnickoIme, imePrezime };
    console.error('[PMF prijava] odgovor bez e-maila i korisničkog imena, oblik:', oblik(podaci));
    throw new PmfGreska('TOKEN_NEVAZECI', NEVAZECI, 401);
};

const slobodnoKorisnickoIme = async (email) => {
    const osnova = (email.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '') || 'korisnik').slice(0, 24).padEnd(3, '_');
    let ime = osnova;
    for (let i = 2; await prisma.user.findFirst({ where: { username: { equals: ime, mode: 'insensitive' } } }); i++) {
        ime = `${osnova}${i}`;
    }
    return ime;
};

// Postojeći nalog (po e-mailu ili korisničkom imenu); inače novi nalog bez upotrebljive lozinke:
// poznat profesor/saradnik dobija ulogu po tome, a potpuno nova osoba postaje asistent (i saradnik).
// Vraća { korisnik, nov } ili null kad IMI nije poslao e-mail (bez njega se nalog ne pravi).
const nadjiIliNapraviKorisnika = async (email, korisnickoIme = null, imePrezime = null) => {
    const izbor = { id: true, username: true, email: true, uloga: true };
    if (email) {
        const postojeci = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: izbor });
        if (postojeci) return { korisnik: postojeci, nov: false };
    }
    // Bez poklapanja po e-mailu: isto korisničko ime, ili e-mail čiji deo pre @ je to ime
    if (korisnickoIme) {
        const poImenu = await prisma.user.findFirst({ where: { username: { equals: korisnickoIme, mode: 'insensitive' } }, select: izbor })
            || await prisma.user.findFirst({ where: { email: { startsWith: `${korisnickoIme}@`, mode: 'insensitive' } }, select: izbor });
        if (poImenu) return { korisnik: poImenu, nov: false };
    }
    if (!email) return null;

    let osoba = await prisma.profesor.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!osoba) {
        // Nova osoba: upis u spisak saradnika sa imenom iz IMI odgovora (ili iz e-maila)
        const izMejla = email.split('@')[0].split(/[._-]+/).filter(Boolean).map((d) => d[0].toUpperCase() + d.slice(1));
        osoba = await prisma.profesor.create({
            data: {
                ime: imePrezime?.ime || izMejla[0] || email,
                prezime: imePrezime?.prezime || izMejla.slice(1).join(' '),
                email,
                is_saradnik: true
            }
        });
    }

    const lozinka = crypto.randomBytes(24).toString('hex'); // niko je ne zna: prijava ide samo preko PMF-a
    const korisnik = await userModel.registerUser(korisnickoIme && !(await prisma.user.findFirst({ where: { username: { equals: korisnickoIme, mode: 'insensitive' } } }))
        ? korisnickoIme : await slobodnoKorisnickoIme(email), email, lozinka, osoba.is_saradnik ? 'asistent' : 'profesor');
    return { korisnik, nov: true };
};

const izdajSesiju = (korisnik) => userModel.generateJwtToken(korisnik);

module.exports = {
    proveriToken, nadjiIliNapraviKorisnika, izdajSesiju, PmfGreska,
    _internal: { nadjiEmail, javljaGresku, nadjiKorisnickoIme, nadjiImePrezime, oblik }
};
