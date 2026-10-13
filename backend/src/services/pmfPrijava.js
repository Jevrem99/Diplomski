const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const config = require('../config/config');
const prisma = require('../db/prisma');
const userModel = require('../models/userModel');

// Prijava preko PMF (IMI) naloga.
// Tok: korisnik se prijavi na IMI -> IMI ga vrati na našu stranicu /auth/callback?token=...
//      -> naš server pita IMI da li je token ispravan i čiji je (verify_token.php) -> mi izdajemo svoju sesiju.
// Pravila: uloga NIKAD ne dolazi od IMI-ja (uzima se iz naše baze), a pristup ima samo osoba čiji je e-mail
// već u našoj bazi (korisnik ili profesor/saradnik).

class PmfGreska extends Error {
    constructor(kod, poruka, status) {
        super(poruka);
        this.kod = kod;
        this.poruka = poruka;
        this.status = status;
    }
}

const TOKEN_OBLIK = /^[A-Fa-f0-9]{64}$/;
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
    const email = !javljaGresku(podaci) ? nadjiEmail(podaci) : null;
    if (!email) throw new PmfGreska('TOKEN_NEVAZECI', NEVAZECI, 401);
    return { email: email.toLowerCase() };
};

const slobodnoKorisnickoIme = async (email) => {
    const osnova = (email.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '') || 'korisnik').slice(0, 24).padEnd(3, '_');
    let ime = osnova;
    for (let i = 2; await prisma.user.findFirst({ where: { username: { equals: ime, mode: 'insensitive' } } }); i++) {
        ime = `${osnova}${i}`;
    }
    return ime;
};

// Postojeći nalog (po e-mailu) ili, ako je osoba poznata kao profesor/saradnik, novi nalog bez upotrebljive lozinke.
// Vraća korisnika ili null kad je e-mail nepoznat.
const nadjiIliNapraviKorisnika = async (email) => {
    const postojeci = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, username: true, email: true, uloga: true }
    });
    if (postojeci) return postojeci;

    const osoba = await prisma.profesor.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!osoba) return null;

    const lozinka = crypto.randomBytes(24).toString('hex'); // niko je ne zna: prijava ide samo preko PMF-a
    return userModel.registerUser(await slobodnoKorisnickoIme(email), email, lozinka, osoba.is_saradnik ? 'asistent' : 'profesor');
};

const izdajSesiju = (korisnik) => userModel.generateJwtToken(korisnik);

module.exports = {
    proveriToken, nadjiIliNapraviKorisnika, izdajSesiju, PmfGreska,
    _internal: { nadjiEmail, javljaGresku }
};
