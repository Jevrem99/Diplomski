const axios = require('axios');
const https = require('https');
const prisma = require('../db/prisma');
const { kljucNaziva } = require('../utils/tekst');

// Nedeljni raspored časova sa IMI sajta (stranica "Raspored časova", imi.pmf.kg.ac.rs/raspored-casova).
// Stranica učitava po jedan fajl za svaku godinu i smer (json_datasets/IIgodInfLet15_rn.js ...); svaki čas ima
// dan i vreme (kao datum u jednoj nedelji 2015: 20.04. = ponedeljak), salu, predmet i nastavnika:
//   description: "sala A-II-25<br><br>Analiza 2<br><br>Suzana Aleksić"
// Odatle se zna koja godina ima nastavu i ko je drži. Zauzeće sala po datumima (day.php) ostaje poseban izvor.

const OSNOVA = 'https://imi.pmf.kg.ac.rs/';
// Sertifikat se proverava, osim ako je u .env izričito isključeno (IMI_INSECURE_TLS=true, kao za učionice)
const klijent = axios.create({
    timeout: 15000,
    responseType: 'text',
    httpsAgent: new https.Agent({ rejectUnauthorized: process.env.IMI_INSECURE_TLS !== 'true' }),
    headers: { 'User-Agent': 'Mozilla/5.0 (raspored kolokvijuma)' }
});
const K_PREUZET = 'raspored_casova_preuzet';

// Rezervni spisak ako se stranica ne može pročitati (isti fajlovi koje stranica danas učitava)
const REZERVNI_FAJLOVI = [
    'IgodMatLet15', 'IIgodMatLet15_pm', 'IIgodMatLet15_ripm', 'IIgodMatLet15_tmip', 'IIIgodMatLet15_pm', 'IIIgodMatLet15_tm',
    'IIIgodMatLet15_tmip', 'IVgodMatLet15_pm', 'IVgodMatLet15_tm', 'IVgodMatLet15_tt', 'MasMatLet15_pm', 'MasMatLet15_tm',
    'MasMatLet15_rm', 'IgodInfLet15', 'IIgodInfLet15_ikt', 'IIgodInfLet15_rn', 'IIgodInfLet15_si', 'IIIgodInfLet15_rns',
    'IIIgodInfLet15_rn', 'IIIgodInfLet15_si', 'IVgodInfLet15_pi', 'IVgodInfLet15_ri', 'IVgodInfLet15_si', 'MasInfLet15', 'MasInfLet15rn'
];

// Fajlovi i njihovi nazivi sa stranice: dugme <a id="II_godina_inf_rn"><label>II godina-računarske nauke</label>
// i $("#II_godina_inf_rn").click(function() { eventData = IIgodInfLet15_rn; ...
const procitajStranicu = (html) => {
    const fajlovi = [...new Set([...String(html).matchAll(/json_datasets\/([A-Za-z0-9_]+)\.js/g)].map((m) => m[1]))];
    const oznakaDugmeta = new Map([...String(html).matchAll(/<a id="([^"]+)"[^>]*>\s*<i[^>]*><\/i>\s*<label>([^<]+)<\/label>/g)].map((m) => [m[1], m[2].trim()]));
    const oznake = new Map();
    for (const m of String(html).matchAll(/\$\("#([^"]+)"\)\.click\(function\(\)\s*\{\s*eventData\s*=\s*([A-Za-z0-9_]+)/g)) {
        if (oznakaDugmeta.has(m[1])) oznake.set(m[2], oznakaDugmeta.get(m[1]));
    }
    return fajlovi.map((f) => ({ fajl: f, oznaka: oznake.get(f) || null }));
};

const RIMSKI = { I: 1, II: 2, III: 3, IV: 4 };
// "II godina-računarske nauke" / "Master-informatika Veštačka inteligencija" + ime fajla -> ko sluša čas
const grupaFajla = (fajl, oznaka) => {
    const odsek = /Inf/.test(fajl) ? 'Informatika' : /Mat/.test(fajl) ? 'Matematika' : '';
    const o = String(oznaka || '').trim();
    const godinaOznake = o.match(/^(IV|III|II|I)\s*godina/i);
    const godinaFajla = fajl.match(/^(IV|III|II|I)god/);
    const master = /^Master/i.test(o) || /^Mas/.test(fajl);
    const godina = master ? null : RIMSKI[(godinaOznake?.[1] || godinaFajla?.[1] || '').toUpperCase()] || null;
    const smer = o.replace(/^(IV|III|II|I)\s*godina\s*-?\s*/i, '').replace(/^Master\s*-?\s*/i, '').trim();
    return { nivo: master ? 'MAS' : 'OAS', godina, odsek, smer };
};

// Časovi iz jednog fajla
const hhmmIz = (iso) => String(iso).substring(11, 16);
const parsirajFajl = (tekst) => {
    const casovi = [];
    const re = /start:\s*'([^']+)'[\s\S]*?end:\s*'([^']+)'[\s\S]*?description:\s*"([^"]*)"/g;
    for (const m of String(tekst).matchAll(re)) {
        const delovi = m[3].split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
        const sala = (delovi.find((d) => /^sala\s/i.test(d)) || '').replace(/^sala\s+/i, '').trim() || null;
        const ostalo = delovi.filter((d) => !/^sala\s/i.test(d));
        const dan = new Date(`${m[1].substring(0, 10)}T00:00:00Z`).getUTCDay(); // 1 = ponedeljak
        if (!ostalo[0] || Number.isNaN(dan)) continue;
        casovi.push({ dan, od: hhmmIz(m[1]), do: hhmmIz(m[2]), predmet: ostalo[0], nastavnik: ostalo[1] || null, sala });
    }
    return casovi;
};

// Preuzima ceo nedeljni raspored i menja tabelu CasRasporeda (samo ako je bar jedan fajl uspešno pročitan)
let uToku = false;
const sinhronizujRasporedCasova = async () => {
    if (uToku) return { preskoceno: true };
    uToku = true;
    try {
        let spisak = [];
        try {
            spisak = procitajStranicu((await klijent.get(`${OSNOVA}raspored-casova`)).data);
        } catch (e) {
            console.warn('[Raspored časova] Stranica nije dostupna, koristim poznati spisak fajlova:', e.message);
        }
        if (!spisak.length) spisak = REZERVNI_FAJLOVI.map((fajl) => ({ fajl, oznaka: null }));

        const redovi = [];
        let procitano = 0;
        for (const { fajl, oznaka } of spisak) {
            try {
                const tekst = (await klijent.get(`${OSNOVA}json_datasets/${fajl}.js`)).data;
                const grupa = grupaFajla(fajl, oznaka);
                parsirajFajl(tekst).forEach((c) => redovi.push({ ...c, ...grupa, izvor: fajl }));
                procitano++;
            } catch (e) {
                console.warn(`[Raspored časova] ${fajl}: ${e.message}`);
            }
        }
        if (!procitano || !redovi.length) throw new Error('Raspored časova nije preuzet sa IMI sajta.');

        await prisma.$transaction([
            prisma.casRasporeda.deleteMany({}),
            prisma.casRasporeda.createMany({ data: redovi }),
            prisma.podesavanje.upsert({
                where: { kljuc: K_PREUZET },
                create: { kljuc: K_PREUZET, vrednost: new Date().toISOString() },
                update: { vrednost: new Date().toISOString() }
            })
        ]);
        console.log(`[Raspored časova] ${redovi.length} časova iz ${procitano} od ${spisak.length} fajlova.`);
        return { casova: redovi.length, fajlova: procitano };
    } finally {
        uToku = false;
    }
};

// Nastava traje u semestru: zimski 1. oktobar – 15. januar, letnji 15. februar – 15. jun.
// Nedeljni raspored važi samo za datume u semestru u kome je preuzet.
const semestar = (d) => {
    const g = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dan = d.getUTCDate();
    if (m >= 10) return `Z${g}`;
    if (m === 1 && dan <= 15) return `Z${g - 1}`;
    if ((m === 2 && dan >= 15) || (m >= 3 && m <= 5) || (m === 6 && dan <= 15)) return `L${g}`;
    return null;
};
const vaziZaDatum = async (datum, db = prisma) => {
    const red = await db.podesavanje.findUnique({ where: { kljuc: K_PREUZET } });
    if (!red) return false;
    const s = semestar(datum);
    return Boolean(s) && s === semestar(new Date(red.vrednost));
};

// Studenti predmeta: godina + nivo studija. Master predmeti imaju šifru "MAS-..." (ili godinu 5),
// ostali su osnovne studije. "Завршни рад" postoji i na 4. godini osnovnih i na master studijama.
const grupaStudenata = (p) => {
    if (!p || !p.godina) return null;
    const master = /^MAS-/i.test(String(p.sifra || '')) || p.godina === 5;
    const godina = p.godina === 5 ? 1 : p.godina;
    return { nivo: master ? 'MAS' : 'OAS', godina, opis: master ? 'master studija' : `${godina}. godine` };
};

// "dr Anica Glođović" -> isti ključ kao osoba "Аница Глођовић" u bazi
const kljucNastavnika = (ime) => kljucNaziva(String(ime || '').replace(/^\s*(dr|prof|doc|mr|msc)\.?\s+/i, ''))
    .split(' ').filter(Boolean).sort().join(' ');
const kljucOsobe = (o) => kljucNaziva(`${o.ime || ''} ${o.prezime || ''}`).split(' ').filter(Boolean).sort().join(' ');

// "Strukture podataka i algoritmi 2 (I grupa)" -> ključ predmeta bez oznake grupe
const kljucCasa = (naziv) => kljucNaziva(String(naziv || '').replace(/\([^)]*\)/g, ' '));

// Smerovi (fajlovi) u kojima se predmet termina predaje: njegovi studenti su tačno ti smerovi te godine
const smeroviPredmeta = (sviCasovi, predmet) => {
    const k = predmet ? kljucCasa(predmet.naziv) : null;
    return new Set(k ? sviCasovi.filter((c) => kljucCasa(c.predmet) === k).map((c) => c.izvor) : []);
};

// casovi: časovi tog dana koji se preklapaju sa terminom; predmet: { naziv, sifra, godina } termina (null = bez provere
// studenata); dezurni: [{ id, ime, prezime }]; smerovi: fajlovi u kojima se predmet predaje (prazno = po godini i nivou).
// Časovi istog predmeta u isto vreme (više smerova) daju jedno upozorenje.
const konfliktiSaRasporedom = ({ casovi, predmet = null, dezurni = [], smerovi = new Set() }) => {
    const grupa = grupaStudenata(predmet);
    const svojPredmet = predmet ? kljucCasa(predmet.naziv) : null;
    const poruke = new Map();
    const dodaj = (kljuc, tip, tekst, smer) => {
        if (!poruke.has(kljuc)) poruke.set(kljuc, { tip, tekst, smerovi: [] });
        if (smer && !poruke.get(kljuc).smerovi.includes(smer)) poruke.get(kljuc).smerovi.push(smer);
    };
    for (const c of casovi) {
        const kada = `${c.od}–${c.do}`;
        const nastavnik = c.nastavnik ? `, ${c.nastavnik}` : '';
        const ciji = `${c.odsek}${c.smer ? ` – ${c.smer}` : ''}`;
        const istiStudenti = smerovi.size
            ? smerovi.has(c.izvor)
            : grupa && c.nivo === grupa.nivo && (grupa.nivo === 'MAS' || c.godina === grupa.godina);
        if (istiStudenti && grupa && kljucCasa(c.predmet) !== svojPredmet) {
            dodaj(`s|${kljucNaziva(c.predmet)}|${kada}`, 'studenti', `Studenti ${grupa.opis} imaju nastavu: „${c.predmet}“${nastavnik}, ${kada}`, ciji);
        }
        if (c.nastavnik) {
            const k = kljucNastavnika(c.nastavnik);
            for (const d of dezurni) {
                if (kljucOsobe(d) !== k) continue;
                dodaj(`n|${d.id}|${kada}`, 'nastava', `Dežurni ${d.ime} ${d.prezime} drži nastavu: „${c.predmet}“, ${kada}${c.sala ? `, sala ${c.sala}` : ''}`, null);
            }
        }
    }
    return [...poruke.values()].map((p) => ({ tip: p.tip, tekst: `${p.tekst}${p.smerovi.length ? ` (${p.smerovi.join('; ')})` : ''}.` }));
};

module.exports = {
    sinhronizujRasporedCasova, vaziZaDatum, konfliktiSaRasporedom, smeroviPredmeta, grupaStudenata,
    _internal: { procitajStranicu, grupaFajla, parsirajFajl, semestar, kljucNastavnika }
};
