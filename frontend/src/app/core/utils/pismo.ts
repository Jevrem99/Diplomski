// Preslovljavanje srpske latinice u ćirilicu za prikaz (isti pristup kao automatska konverzija pisma
// na srpskoj Vikipediji). Tekstovi u kodu ostaju na latinici; ovde se pretvaraju neposredno pre prikaza.
// Čista funkcija bez zavisnosti, pa se lako testira (vidi pismo.spec.ts).

const SLOVA: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', đ: 'ђ', e: 'е', ž: 'ж', z: 'з', i: 'и', j: 'ј', k: 'к', l: 'л', m: 'м',
  n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', ć: 'ћ', u: 'у', f: 'ф', h: 'х', c: 'ц', č: 'ч', š: 'ш',
  A: 'А', B: 'Б', V: 'В', G: 'Г', D: 'Д', Đ: 'Ђ', E: 'Е', Ž: 'Ж', Z: 'З', I: 'И', J: 'Ј', K: 'К', L: 'Л', M: 'М',
  N: 'Н', O: 'О', P: 'П', R: 'Р', S: 'С', T: 'Т', Ć: 'Ћ', U: 'У', F: 'Ф', H: 'Х', C: 'Ц', Č: 'Ч', Š: 'Ш',
};

// Dva latinična slova = jedno ćirilično
const DIGRAFI: Record<string, string> = {
  lj: 'љ', Lj: 'Љ', LJ: 'Љ', nj: 'њ', Nj: 'Њ', NJ: 'Њ', dž: 'џ', Dž: 'Џ', DŽ: 'Џ',
};

// Reči u kojima su "nj" / "dž" dva zasebna glasa (ne spajaju se u њ / џ)
const RAZDVOJENO = ['injekc', 'injunkc', 'konjunk', 'konjug', 'tanjug', 'vanjezič', 'nadživ', 'nadžnj', 'odžal', 'podžanr', 'predžetv'];

// Reči sa utvrđenim oblikom (ključ malim slovima)
const UTVRDJENO: Record<string, string> = {
  imi: 'ИМИ',
  'e-mail': 'имејл',
  email: 'имејл',
  mail: 'мејл',
};

// Ostaje latinicom: oznake jedinica i formati fajlova
const BEZ_IZMENE = new Set(['h', 'ics', 'pdf', 'xlsx', 'html', 'css', 'id']);

const IMA_LATINICE = /[A-Za-zČĆŠŽĐčćšžđ]/;
// "Reč": počinje slovom; može da sadrži cifre, crticu, tačku, @, _ i / (šifre sala, e-mail adrese, putanje)
const REC = /[A-Za-zČĆŠŽĐčćšžđ][A-Za-zČĆŠŽĐčćšžđ0-9@_\-./]*/g;
const ADRESA = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const RAZMAK_NULA = '‌';

function kaoUzorak(uzorak: string, rec: string): string {
  if (uzorak.length > 1 && uzorak === uzorak.toUpperCase()) return rec.toUpperCase();
  if (uzorak[0] === uzorak[0].toUpperCase()) return rec[0].toUpperCase() + rec.slice(1);
  return rec;
}

function presloviRec(rec: string): string {
  // tačka, crtica ili kosa crta na kraju pripadaju rečenici, ne reči ("termin." / "npr.")
  const rep = rec.match(/[.\-/]+$/)?.[0] ?? '';
  const jezgro = rep ? rec.slice(0, -rep.length) : rec;
  const malo = jezgro.toLowerCase();

  if (UTVRDJENO[malo]) return kaoUzorak(jezgro, UTVRDJENO[malo]) + rep;
  if (BEZ_IZMENE.has(malo)) return rec;
  // šifre i adrese: sadrže cifru, @ ili _ ("A-II-24R", "ime@pmf.kg.ac.rs")
  if (/[0-9@_]/.test(jezgro)) return rec;
  // strane reči: q, w, x, y ne postoje u srpskoj latinici ("Excel")
  if (/[qwxyQWXY]/.test(jezgro)) return rec;
  // rimski brojevi (tip kolokvijuma, godine studija): I, II, III, IV ...
  if (/^[IVX]+$/.test(jezgro)) return rec;

  let t = jezgro;
  for (const koren of RAZDVOJENO) {
    const i = t.toLowerCase().indexOf(koren);
    if (i >= 0) {
      // razdvoji prvi digraf u korenu nevidljivim znakom, da se ne spoji
      const m = t.slice(i, i + koren.length).match(/nj|dž/i);
      if (m && m.index !== undefined) {
        const poz = i + m.index + 1;
        t = t.slice(0, poz) + RAZMAK_NULA + t.slice(poz);
      }
    }
  }

  let izlaz = '';
  for (let i = 0; i < t.length; i++) {
    const par = t.substring(i, i + 2);
    if (DIGRAFI[par]) { izlaz += DIGRAFI[par]; i++; continue; }
    const znak = t[i];
    if (znak === RAZMAK_NULA) continue;
    izlaz += SLOVA[znak] ?? znak;
  }
  return izlaz + rep;
}

/** Preslovljava tekst u ćirilicu. Ćirilični delovi, brojevi, šifre i adrese ostaju kakvi jesu. */
export function uCirilicu(tekst: string): string {
  if (!tekst || !IMA_LATINICE.test(tekst)) return tekst;
  // veb adrese se ne diraju
  const adrese: string[] = [];
  const bezAdresa = tekst.replace(ADRESA, (a) => { adrese.push(a); return `\u0000${adrese.length - 1}\u0000`; });
  const preslovljeno = bezAdresa.replace(REC, presloviRec);
  return adrese.length ? preslovljeno.replace(/\u0000(\d+)\u0000/g, (_, i) => adrese[Number(i)]) : preslovljeno;
}

export function imaLatinice(tekst: string | null | undefined): boolean {
  return !!tekst && IMA_LATINICE.test(tekst);
}
