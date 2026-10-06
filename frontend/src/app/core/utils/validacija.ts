// Ista pravila kao na serveru (backend/src/utils/validators.js). Server je konačan sud, ovo samo
// daje brzu i jasnu povratnu informaciju pre slanja.

export type Polja = Record<string, string>;

const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,30}$/;
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const ULOGE = ['admin', 'profesor', 'asistent'];

const prazno = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === '';

export const HINTOVI: Record<string, string> = {
  username: '3–30 karaktera: slova, cifre, tačka, crtica, donja crta (bez razmaka)',
  email: 'npr. ime@pmf.kg.ac.rs',
  password: 'Najmanje 8 karaktera, bar jedno slovo i jedna cifra',
};

export function proveriLozinku(lozinka: unknown): string | null {
  const l = typeof lozinka === 'string' ? lozinka : '';
  if (l.length < 8) return 'Lozinka mora imati najmanje 8 karaktera.';
  if (l.length > 72) return 'Lozinka može imati najviše 72 karaktera.';
  if (!/[A-Za-z]/.test(l) || !/\d/.test(l)) return 'Lozinka mora sadržati bar jedno slovo i bar jednu cifru.';
  return null;
}

const proveriEmail = (email: unknown): string | null =>
  EMAIL_REGEX.test(String(email ?? '').trim()) ? null : 'E-mail nije u ispravnom formatu (npr. ime@pmf.kg.ac.rs).';

export function validirajKorisnika(b: any, lozinkaObavezna: boolean): Polja {
  const polja: Polja = {};
  if (prazno(b.username)) polja['username'] = 'Korisničko ime je obavezno.';
  else if (!USERNAME_REGEX.test(String(b.username).trim()))
    polja['username'] = 'Korisničko ime: 3–30 karaktera, samo slova, cifre, tačka, crtica i donja crta (bez razmaka).';
  if (prazno(b.email)) polja['email'] = 'E-mail je obavezan.';
  else { const g = proveriEmail(b.email); if (g) polja['email'] = g; }
  if (lozinkaObavezna || !prazno(b.password)) {
    const g = proveriLozinku(b.password);
    if (g) polja['password'] = g;
  }
  if (prazno(b.uloga)) polja['uloga'] = 'Izaberite ulogu.';
  else if (!ULOGE.includes(b.uloga)) polja['uloga'] = 'Nepoznata uloga.';
  return polja;
}

export function validirajOsobu(b: any): Polja {
  const polja: Polja = {};
  if (prazno(b.ime)) polja['ime'] = 'Ime je obavezno.';
  else if (String(b.ime).trim().length > 60) polja['ime'] = 'Ime može imati najviše 60 karaktera.';
  if (prazno(b.prezime)) polja['prezime'] = 'Prezime je obavezno.';
  else if (String(b.prezime).trim().length > 60) polja['prezime'] = 'Prezime može imati najviše 60 karaktera.';
  if (!prazno(b.email)) { const g = proveriEmail(b.email); if (g) polja['email'] = g; }
  return polja;
}

export function validirajPredmet(b: any): Polja {
  const polja: Polja = {};
  if (prazno(b.sifra)) polja['sifra'] = 'Šifra je obavezna.';
  if (prazno(b.naziv)) polja['naziv'] = 'Naziv je obavezan.';
  const godina = Number(b.godina);
  if (prazno(b.godina) || !Number.isInteger(godina) || godina < 1 || godina > 6) polja['godina'] = 'Godina mora biti ceo broj od 1 do 6.';
  if (prazno(b.semestar)) polja['semestar'] = 'Semestar je obavezan (Zimski ili Letnji).';
  if (!prazno(b.broj_studenata)) {
    const n = Number(b.broj_studenata);
    if (!Number.isInteger(n) || n < 0) polja['broj_studenata'] = 'Broj studenata mora biti ceo broj, 0 ili veći.';
  }
  return polja;
}

// Iz HTTP greške izvlači opštu poruku i poruke po poljima koje šalje server
export function procitajGresku(err: any, rezerva = 'Došlo je do greške.'): { opsta: string; polja: Polja } {
  const telo = err?.error;
  if (err?.status === 0) return { opsta: 'Server nije dostupan. Proverite vezu.', polja: {} };
  if (err?.status === 403) return { opsta: 'Nemate dozvolu za ovu akciju.', polja: {} };
  return {
    opsta: (typeof telo === 'string' ? telo : telo?.error || telo?.message) || rezerva,
    polja: telo?.polja || {},
  };
}

export function validirajIspit(b: any): Polja {
  const polja: Polja = {};
  if (prazno(b.predmet_id)) polja['predmet_id'] = 'Izaberite predmet.';
  if (prazno(b.datum)) polja['datum'] = 'Datum je obavezan.';
  else if (Number.isNaN(new Date(String(b.datum)).getTime())) polja['datum'] = 'Datum nije ispravan.';
  const vreme = /^\d{2}:\d{2}/;
  if (prazno(b.vreme)) polja['vreme'] = 'Vreme početka je obavezno.';
  else if (!vreme.test(String(b.vreme))) polja['vreme'] = 'Vreme mora biti u formatu SS:MM.';
  if (!prazno(b.vreme_kraja)) {
    if (!vreme.test(String(b.vreme_kraja))) polja['vreme_kraja'] = 'Vreme mora biti u formatu SS:MM.';
    else if (!prazno(b.vreme) && String(b.vreme_kraja).substring(0, 5) <= String(b.vreme).substring(0, 5)) polja['vreme_kraja'] = 'Kraj mora biti posle početka.';
  }
  return polja;
}
