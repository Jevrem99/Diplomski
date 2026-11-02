const prisma = require('../db/prisma');
const { kljucNaziva } = require('../utils/tekst');

// Konflikti sa redovnom nastavom po studentima i nastavnicima.
// IMI raspored zauzeća (day.php) daje samo salu, vreme i naziv časa ("Analiza 2 (P)"), bez godine i nastavnika,
// pa se naziv časa poredi sa nazivima predmeta u bazi: predmet daje godinu studija, a (P) profesora, (V) saradnike.
// Časovi koji se ne poklope ni sa jednim predmetom (sastanci, nepoznati predmeti) se preskaču.

// "Analiza 2 (P)", "Комбинаторне структуре (П)", "Teorijske osnove informatike (V, II grupa)" -> ključ i vrsta časa
const procitajCas = (tekst) => {
    const t = String(tekst || '');
    let vrsta = null;
    if (/\(\s*(P|П)\s*\+\s*(V|В)\s*[,)]/i.test(t)) vrsta = null; // i predavanja i vežbe
    else if (/\(\s*(P|П)\s*[,)]/i.test(t)) vrsta = 'P';
    else if (/\(\s*(V|В)\s*[,)]/i.test(t)) vrsta = 'V';
    const bezZagrada = t.replace(/\([^)]*\)/g, ' ').replace(/\s[-–]\s.*$/, ' ');
    return { kljuc: kljucNaziva(bezZagrada), vrsta };
};

// Studenti istog predmeta: godina + nivo studija. Master predmeti imaju šifru "MAS-..." (ili godinu 5),
// ostali su osnovne studije. "Завршни рад" postoji i na 4. godini osnovnih i na 1. godini master studija.
const grupaStudenata = (p) => {
    if (!p || !p.godina) return null;
    const master = /^MAS-/i.test(String(p.sifra || '')) || p.godina === 5;
    return { kljuc: `${master ? 'MAS' : 'OAS'}-${p.godina === 5 ? 1 : p.godina}`, opis: master ? `${p.godina === 5 ? 1 : p.godina}. godine master studija` : `${p.godina}. godine` };
};

// Predmeti po ključu naziva (osvežava se svakih minut; više predmeta može imati isti naziv)
let kesPredmeta = { vreme: 0, mapa: new Map() };
const predmetiPoNazivu = async () => {
    if (Date.now() - kesPredmeta.vreme < 60 * 1000) return kesPredmeta.mapa;
    const predmeti = await prisma.predmet.findMany({
        select: { id: true, sifra: true, naziv: true, godina: true, profesor_id: true, saradnici: { select: { id: true } } }
    });
    const mapa = new Map();
    for (const p of predmeti) {
        const k = kljucNaziva(p.naziv);
        if (!mapa.has(k)) mapa.set(k, []);
        mapa.get(k).push({ id: p.id, sifra: p.sifra, naziv: p.naziv, godina: p.godina, profesor_id: p.profesor_id, saradnici: p.saradnici.map((s) => s.id) });
    }
    kesPredmeta = { vreme: Date.now(), mapa };
    return mapa;
};

// Nastavnici koji drže taj čas: (P) profesor, (V) saradnici, bez oznake oba
const nastavniciCasa = (predmet, vrsta) => [
    ...(vrsta !== 'V' && predmet.profesor_id ? [predmet.profesor_id] : []),
    ...(vrsta !== 'P' ? predmet.saradnici : [])
];

// nastava: časovi tog dana { predmet, vreme_pocetka, vreme_kraja } koji se preklapaju sa terminom
// predmet: predmet koji se zakazuje { id, sifra, godina } (null = studenti se ne proveravaju)
// dezurni: id-jevi dežurnih; imena: Map id -> "Ime Prezime"; vreme(n): "10:00–12:00"
// Više časova istog naziva daje jedno upozorenje sa svim vremenima.
const konfliktiSaNastavom = ({ nastava, mapa, predmet = null, dezurni = [], imena = new Map(), vreme }) => {
    const grupa = grupaStudenata(predmet);
    const poruke = new Map(); // ključ -> { tip, pocetak, vremena[] }
    const dodaj = (kljuc, tip, pocetak, kada) => {
        if (!poruke.has(kljuc)) poruke.set(kljuc, { tip, pocetak, vremena: [] });
        const p = poruke.get(kljuc);
        if (!p.vremena.includes(kada)) p.vremena.push(kada);
    };
    for (const n of nastava) {
        const { kljuc, vrsta } = procitajCas(n.predmet);
        const predmeti = mapa.get(kljuc) || [];
        if (!predmeti.length) continue;
        const kada = vreme(n);
        if (grupa && !predmeti.some((p) => p.id === predmet.id)
            && predmeti.some((p) => grupaStudenata(p)?.kljuc === grupa.kljuc)) {
            dodaj(`s|${kljuc}`, 'studenti', `Studenti ${grupa.opis} imaju nastavu: „${n.predmet}“`, kada);
        }
        for (const id of dezurni) {
            if (!predmeti.some((p) => nastavniciCasa(p, vrsta).includes(id))) continue;
            dodaj(`n|${id}|${kljuc}|${vrsta}`, 'nastava', `Dežurni ${imena.get(id) || '(nepoznat)'} ima nastavu: „${n.predmet}“`, kada);
        }
    }
    return [...poruke.values()].map((p) => ({ tip: p.tip, tekst: `${p.pocetak} (${p.vremena.join(', ')}).` }));
};

module.exports = { procitajCas, grupaStudenata, predmetiPoNazivu, konfliktiSaNastavom };
