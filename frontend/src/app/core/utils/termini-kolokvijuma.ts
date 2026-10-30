// Podaci koje nastavnici unose na stranici "Termini kolokvijuma" (željeni datumi, trajanje, sala, broj dežurnih),
// u obliku koji koriste banka predmeta, prozor termina i kalendar.

export type KljucKolokvijuma = 'k1' | 'k2' | 'k3' | 'popravni';

const OZNAKE: Record<KljucKolokvijuma, string> = { k1: 'I', k2: 'II', k3: 'III', popravni: 'Pop.' };
const NAZIVI: Record<KljucKolokvijuma, string> = { k1: 'I kolokvijum', k2: 'II kolokvijum', k3: 'III kolokvijum', popravni: 'Popravni' };

// Vrsta termina iz rasporeda -> koji uneti kolokvijum predstavlja (test se ne vezuje ni za jedan)
export function kljucZaTip(tip: string | null | undefined, isIspit: boolean): KljucKolokvijuma | null {
  if (isIspit) return null;
  const t = String(tip || 'I').trim().toLowerCase();
  if (t.includes('поправни') || t.includes('popravni')) return 'popravni';
  if (t === 'iii') return 'k3';
  if (t === 'ii') return 'k2';
  if (t === 'i') return 'k1';
  return null;
}

// "29.04.2026" -> "29.04."
const kratko = (d: string | null | undefined): string => {
  const m = String(d || '').match(/^(\d{2})\.(\d{2})\./);
  return m ? `${m[1]}.${m[2]}.` : '';
};

export interface UnetiKolokvijum {
  kljuc: KljucKolokvijuma;
  naziv: string;
  datum: string | null;       // DD.MM.GGGG
  trajanje: number | null;    // minuta
  racunarska: boolean;
  dezurni: number | null;
  uTerminuIspita?: boolean;
}

// Kolokvijumi za koje je nešto uneto (datum ili trajanje; popravni i kad je "u terminu ispita")
export function unetiKolokvijumi(t: any): UnetiKolokvijum[] {
  if (!t) return [];
  const lista: UnetiKolokvijum[] = [];
  for (const k of ['k1', 'k2', 'k3'] as const) {
    if (t[`${k}_datum`] || t[`${k}_trajanje`]) {
      lista.push({ kljuc: k, naziv: NAZIVI[k], datum: t[`${k}_datum`] || null, trajanje: t[`${k}_trajanje`] ?? null,
        racunarska: !!t[`${k}_racunarska_sala`], dezurni: t[`${k}_dezurni`] ?? null });
    }
  }
  if (t.popravni_datum || t.popravni_trajanje || t.popravni_u_terminu_ispita) {
    lista.push({ kljuc: 'popravni', naziv: NAZIVI.popravni, datum: t.popravni_datum || null, trajanje: t.popravni_trajanje ?? null,
      racunarska: !!t.popravni_racunarska_sala, dezurni: t.popravni_dezurni ?? null, uTerminuIspita: !!t.popravni_u_terminu_ispita });
  }
  return lista;
}

// Kratak red za karticu u banci: "I 29.04. · II 03.06. · Pop. 17.06."
export function kratkiDatumi(t: any): string {
  return unetiKolokvijumi(t)
    .filter((k) => k.datum || k.uTerminuIspita)
    .map((k) => `${OZNAKE[k.kljuc]} ${k.datum ? kratko(k.datum) : 'u ispitnom roku'}`)
    .join(' · ');
}

// Jedan red sa svim podacima: "I kolokvijum: 29.04.2026, 90 min, računarska sala, 3 dežurna"
export function opisKolokvijuma(k: UnetiKolokvijum): string {
  const delovi = [
    k.datum || (k.uTerminuIspita ? 'u terminu ispita' : 'datum nije unet'),
    k.trajanje ? `${k.trajanje} min` : null,
    k.racunarska ? 'računarska sala' : null,
    k.dezurni != null ? `dežurnih: ${k.dezurni}` : null
  ].filter(Boolean);
  return `${k.naziv}: ${delovi.join(', ')}`;
}

// Potreban broj dežurnih za vrstu termina (null kad nije unet)
export function potrebnoDezurnihZa(t: any, tip: string | null | undefined, isIspit: boolean): number | null {
  const k = kljucZaTip(tip, isIspit);
  if (!t || !k) return null;
  const v = t[`${k}_dezurni`];
  return typeof v === 'number' ? v : null;
}
