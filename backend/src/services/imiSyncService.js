const axios = require('axios');
const cheerio = require('cheerio');
const prisma = require('../db/prisma');
const { mapLimit } = require('../utils/mapLimit');
const { normalizujNazivSale, nadjiIliNapraviSalu } = require('../utils/sale');

const IMI_DAY_URL = 'https://imi.pmf.kg.ac.rs/cp/rs/day.php';
const PARALELNIH_ZAHTEVA = 5;

// Podrazumevani period: letnji semestar (mart-jun) ili zimski (okt-januar) prema današnjem datumu
const podrazumevaniPeriod = () => {
    const danas = new Date();
    const god = danas.getFullYear();
    const mesec = danas.getMonth(); // 0-11
    if (mesec >= 9) return { od: new Date(god, 9, 1), do: new Date(god + 1, 0, 31) };
    if (mesec === 0) return { od: new Date(god - 1, 9, 1), do: new Date(god, 0, 31) };
    return { od: new Date(god, 2, 1), do: new Date(god, 5, 15) };
};

const parsirajDatum = (v) => {
    if (!v) return null;
    const d = new Date(`${String(v).split('T')[0]}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
};

// Preuzima i parsira jedan dan; vraća listu { salaNaziv, datum, vreme_pocetka, vreme_kraja, predmet }
async function preuzmiDan(dan) {
    const response = await axios.post(
        IMI_DAY_URL,
        `day=${dan.d}&month=${dan.m}&year=${dan.y}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
    );

    const html = response.data && response.data.result;
    if (!html) return [];

    const $ = cheerio.load(html);

    const saleNazivi = [];
    $('table > tbody > tr:nth-child(2) > td').each((i, td) => {
        if (i > 0) {
            const txt = $(td).text().trim();
            if (txt) saleNazivi.push(txt);
        }
    });

    const kolone = $('table > tbody > tr:nth-child(3) > td[rowspan="17"]').toArray();
    const termini = [];
    const datum = new Date(Date.UTC(dan.y, dan.m - 1, dan.d));

    kolone.forEach((kolona, i) => {
        const salaNaziv = saleNazivi[i];
        if (!salaNaziv) return;

        $(kolona).find('a').toArray().forEach((aTag) => {
            const vremeTekst = $(aTag).find('small').text().trim();
            if (!vremeTekst || !vremeTekst.includes('-')) return;

            const predmet = $(aTag).text().replace(vremeTekst, '').trim().replace(/^"/, '').replace(/"$/, '').trim();
            const [pocetak, kraj] = vremeTekst.split('-');
            termini.push({ salaNaziv: normalizujNazivSale(salaNaziv), datum, vreme_pocetka: pocetak.trim(), vreme_kraja: kraj.trim(), predmet });
        });
    });

    return termini;
}

// Sinhronizacija redovne nastave sa IMI sajta.
// Opciono: { od: 'YYYY-MM-DD', do: 'YYYY-MM-DD' }. Stari podaci iz tog perioda se menjaju tek
// kada je bar jedan dan uspešno preuzet, i to u jednoj transakciji.
const izvrsiSync = async ({ od, do: doDatum } = {}) => {
    const period = podrazumevaniPeriod();
    const startDate = parsirajDatum(od) || period.od;
    const endDate = parsirajDatum(doDatum) || period.do;

    const dani = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0) { // bez nedelje
            dani.push({ d: d.getDate(), m: d.getMonth() + 1, y: d.getFullYear() });
        }
    }

    console.log(`Započinjem preuzimanje rasporeda za ${dani.length} dana...`);

    let neuspelih = 0;
    let uspelih = 0;
    const rezultati = await mapLimit(dani, PARALELNIH_ZAHTEVA, async (dan) => {
        try {
            const termini = await preuzmiDan(dan);
            uspelih++;
            return termini;
        } catch (error) {
            neuspelih++;
            console.error(`Greška za datum ${dan.d}.${dan.m}.${dan.y}:`, error.message);
            return [];
        }
    });

    if (uspelih === 0) {
        throw new Error('Nijedan dan nije preuzet sa IMI servera - postojeći podaci su ostali netaknuti.');
    }

    const termini = rezultati.flat();

    // Sale: jedan upit za sve postojeće + kreiranje samo nedostajućih
    const nazivi = [...new Set(termini.map((t) => t.salaNaziv))];
    const salaCache = new Map();
    const salaId = new Map();
    for (const naziv of nazivi) {
        const sala = await nadjiIliNapraviSalu(prisma, naziv, salaCache);
        if (sala) salaId.set(naziv, sala.id);
    }

    const redovi = termini
        .filter((t) => salaId.has(t.salaNaziv))
        .map((t) => ({
            sala_id: salaId.get(t.salaNaziv),
            datum: t.datum,
            vreme_pocetka: t.vreme_pocetka,
            vreme_kraja: t.vreme_kraja,
            predmet: t.predmet
        }));

    const od0 = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
    const do0 = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));

    await prisma.$transaction([
        prisma.redovnaNastava.deleteMany({ where: { datum: { gte: od0, lte: do0 } } }),
        prisma.redovnaNastava.createMany({ data: redovi })
    ], { timeout: 60000 });

    return {
        success: true,
        poruka: `Sinhronizovano ${redovi.length} termina redovne nastave (${uspelih} dana preuzeto${neuspelih ? `, ${neuspelih} neuspelo` : ''}).`
    };
};

// Jedna sinhronizacija u isto vreme (ručna i noćna se ne preklapaju)
let uToku = false;
const syncZauzetostSala = async (opcije = {}) => {
    if (uToku) throw new Error('Sinhronizacija je već u toku, pokušajte kasnije.');
    uToku = true;
    try {
        return await izvrsiSync(opcije);
    } finally {
        uToku = false;
    }
};

module.exports = { syncZauzetostSala };
