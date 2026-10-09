// Pravila za unos podataka. ISTA pravila postoje i u frontendu (src/app/core/utils/validacija.ts),
// ali server je uvek konačan sud - klijentskoj proveri se ne veruje.

const ULOGE = ['admin', 'profesor', 'asistent'];
const MIN_DUZINA_LOZINKE = 8;
const MAX_DUZINA_LOZINKE = 72; // bcrypt ignoriše sve posle 72. bajta

const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,30}$/;
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const jeValidnaUloga = (uloga) => ULOGE.includes(uloga);
const prazno = (v) => v === undefined || v === null || String(v).trim() === '';

// Vraća poruku o grešci ili null ako je lozinka u redu
const proveriLozinku = (lozinka) => {
    if (typeof lozinka !== 'string' || lozinka.length < MIN_DUZINA_LOZINKE) {
        return `Lozinka mora imati najmanje ${MIN_DUZINA_LOZINKE} karaktera.`;
    }
    if (lozinka.length > MAX_DUZINA_LOZINKE) {
        return `Lozinka može imati najviše ${MAX_DUZINA_LOZINKE} karaktera.`;
    }
    if (!/[A-Za-z]/.test(lozinka) || !/\d/.test(lozinka)) {
        return 'Lozinka mora sadržati bar jedno slovo i bar jednu cifru.';
    }
    return null;
};

const proveriEmail = (email) => (EMAIL_REGEX.test(String(email || '').trim()) ? null : 'E-mail nije u ispravnom formatu (npr. ime@pmf.kg.ac.rs).');

// Početak i kraj termina (HH:MM, može i puni ISO "…T09:00:00"). Kraj mora biti posle početka.
const uMinute = (v) => {
    const m = String(v ?? '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const proveriVremena = (vreme, kraj) => {
    if (prazno(vreme) || prazno(kraj)) return null;
    const a = uMinute(vreme);
    const b = uMinute(kraj);
    if (a === null || b === null) return 'Vreme mora biti u formatu SS:MM.';
    if (b <= a) return 'Vreme kraja mora biti posle vremena početka.';
    return null;
};

// Svaka funkcija vraća objekat { imePolja: 'poruka' } - prazan objekat znači da je sve u redu
const validirajKorisnika = (b, { lozinkaObavezna = true } = {}) => {
    const polja = {};
    if (prazno(b.username)) polja.username = 'Korisničko ime je obavezno.';
    else if (!USERNAME_REGEX.test(String(b.username).trim())) {
        polja.username = 'Korisničko ime: 3–30 karaktera, samo slova, cifre, tačka, crtica i donja crta (bez razmaka).';
    }
    if (prazno(b.email)) polja.email = 'E-mail je obavezan.';
    else if (proveriEmail(b.email)) polja.email = proveriEmail(b.email);
    if (lozinkaObavezna || !prazno(b.password)) {
        const g = proveriLozinku(b.password);
        if (g) polja.password = g;
    }
    if (!prazno(b.uloga) && !jeValidnaUloga(b.uloga)) polja.uloga = `Uloga mora biti jedna od: ${ULOGE.join(', ')}.`;
    return polja;
};

const validirajOsobu = (b) => {
    const polja = {};
    if (prazno(b.ime)) polja.ime = 'Ime je obavezno.';
    else if (String(b.ime).trim().length > 60) polja.ime = 'Ime može imati najviše 60 karaktera.';
    if (prazno(b.prezime)) polja.prezime = 'Prezime je obavezno.';
    else if (String(b.prezime).trim().length > 60) polja.prezime = 'Prezime može imati najviše 60 karaktera.';
    if (!prazno(b.email) && proveriEmail(b.email)) polja.email = proveriEmail(b.email);
    return polja;
};

const validirajPredmet = (b) => {
    const polja = {};
    if (prazno(b.sifra)) polja.sifra = 'Šifra je obavezna.';
    if (prazno(b.naziv)) polja.naziv = 'Naziv je obavezan.';
    const godina = Number(b.godina);
    if (prazno(b.godina) || !Number.isInteger(godina) || godina < 1 || godina > 6) polja.godina = 'Godina mora biti ceo broj od 1 do 6.';
    if (prazno(b.semestar)) polja.semestar = 'Semestar je obavezan (Zimski ili Letnji).';
    if (!prazno(b.broj_studenata)) {
        const n = Number(b.broj_studenata);
        if (!Number.isInteger(n) || n < 0) polja.broj_studenata = 'Broj studenata mora biti ceo broj, 0 ili veći.';
    }
    return polja;
};

// Grupa predmeta: naziv + najmanje dva različita predmeta
const validirajGrupu = (b) => {
    const polja = {};
    if (prazno(b.naziv)) polja.naziv = 'Naziv grupe je obavezan.';
    else if (String(b.naziv).trim().length > 80) polja.naziv = 'Naziv grupe može imati najviše 80 karaktera.';
    const sirovi = b.predmet_ids || b.predmeti_ids;
    const ids = Array.isArray(sirovi) ? [...new Set(sirovi.map(Number).filter(Number.isInteger))] : [];
    if (ids.length < 2) polja.predmeti_ids = 'Grupa mora imati najmanje dva predmeta.';
    return polja;
};

// Ključ jednog postavljanja grupe na raspored (pravi ga klijent); prazno ili neispravno -> null
const ocistiGrupaKljuc = (v) => {
    const t = typeof v === 'string' ? v.trim() : '';
    return /^[A-Za-z0-9_-]{4,64}$/.test(t) ? t : null;
};

// Šalje 400 sa porukom po poljima ako ih ima; vraća true ako je odgovor poslat
const odbaciAkoImaGresaka = (res, polja) => {
    if (Object.keys(polja).length === 0) return false;
    res.status(400).json({ error: 'Neispravni podaci. Ispravite označena polja.', polja });
    return true;
};

// Prisma P2002 = povreda jedinstvenosti, P2025 = zapis ne postoji
const POLJE_PORUKE = {
    sifra: 'Predmet sa ovom šifrom već postoji.',
    username: 'Korisničko ime je već zauzeto.',
    email: 'Ovaj e-mail se već koristi.',
    naziv: 'Zapis sa ovim nazivom već postoji.'
};
const mapirajPrismaGresku = (error, res) => {
    if (error && error.code === 'P2002') {
        const mete = [].concat(error.meta?.target || []).map(String).join(',');
        const polje = Object.keys(POLJE_PORUKE).find((k) => mete.includes(k));
        res.status(409).json({
            error: polje ? POLJE_PORUKE[polje] : 'Zapis sa tim podacima već postoji.',
            ...(polje ? { polja: { [polje]: POLJE_PORUKE[polje] } } : {})
        });
        return true;
    }
    if (error && error.code === 'P2003') {
        res.status(409).json({ error: 'Zapis se ne može obrisati/izmeniti jer je povezan sa drugim podacima.' });
        return true;
    }
    if (error && error.code === 'P2025') {
        res.status(404).json({ error: 'Zapis nije pronađen.' });
        return true;
    }
    return false;
};

module.exports = {
    ULOGE, jeValidnaUloga, proveriLozinku, proveriEmail, proveriVremena,
    validirajKorisnika, validirajOsobu, validirajPredmet, validirajGrupu, ocistiGrupaKljuc,
    odbaciAkoImaGresaka, mapirajPrismaGresku
};
