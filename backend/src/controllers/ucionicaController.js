const axios = require('axios');
const https = require('https');
const prisma = require('../db/prisma');
const { mapLimit } = require('../utils/mapLimit');

let cachedUcionice = [];
let isFetching = false;
let intervalId = null;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const secureClient = axios.create({ timeout: 15000, headers: { 'User-Agent': BROWSER_UA } });
const insecureClient = axios.create({
  timeout: 15000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: { 'User-Agent': BROWSER_UA }
});

// Prvo se pokušava sa proverom TLS sertifikata; samo ako IMI sertifikat nije validan, prelazi se na
// nesigurnu vezu (podaci su javni, ali se u logu jasno vidi da se to desilo).
let koristiNesigurno = process.env.IMI_INSECURE_TLS === 'true';
async function imiRequest(method, url, data) {
  const pozovi = (client) => (method === 'post' ? client.post(url, data) : client.get(url));
  if (koristiNesigurno) return pozovi(insecureClient);
  try {
    return await pozovi(secureClient);
  } catch (err) {
    if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ISSUER/i.test(String(err.code || err.message))) {
      console.warn('[IMI] Sertifikat nije validan - prelazim na vezu bez provere sertifikata.');
      koristiNesigurno = true;
      return pozovi(insecureClient);
    }
    throw err;
  }
}

const JSON_DATASETS = [
  'IgodMatLet15.js', 'IIgodMatLet15_pm.js', 'IIgodMatLet15_ripm.js', 'IIgodMatLet15_tmip.js',
  'IIIgodMatLet15_pm.js', 'IIIgodMatLet15_tm.js', 'IIIgodMatLet15_tmip.js', 'IVgodMatLet15_pm.js',
  'IVgodMatLet15_tm.js', 'IVgodMatLet15_tt.js', 'MasMatLet15_pm.js', 'MasMatLet15_tm.js',
  'MasMatLet15_rm.js', 'IgodInfLet15.js', 'IIgodInfLet15_ikt.js', 'IIgodInfLet15_rn.js',
  'IIgodInfLet15_si.js', 'IIIgodInfLet15_rns.js', 'IIIgodInfLet15_rn.js', 'IIIgodInfLet15_si.js',
  'IVgodInfLet15_pi.js', 'IVgodInfLet15_ri.js', 'IVgodInfLet15_si.js', 'MasInfLet15.js', 'MasInfLet15rn.js'
];

// Helper za povlačenje iz JSON skupova (po 5 zahteva istovremeno)
async function fetchIzJsonDatasets() {
  const ucioniceSet = new Set();
  const baseUrl = 'https://imi.pmf.kg.ac.rs/json_datasets/';
  let neuspelih = 0;

  await mapLimit(JSON_DATASETS, 5, async (file) => {
    try {
      const response = await imiRequest('get', `${baseUrl}${file}`);
      const content = String(response.data);

      const propertyRegex = /"(?:ucionica|sala|u|mesto|prostorija|room)"\s*:\s*"([^"]+)"/gi;
      let match;
      while ((match = propertyRegex.exec(content)) !== null) {
        if (match[1] && match[1].trim()) ucioniceSet.add(match[1].trim());
      }

      const roomPatternRegex = /(A-[I|V|0-9]+-[0-9]+[a-z]?|Lab[- ]?[0-9]+|Amfiteatar|Svečana sala)/gi;
      while ((match = roomPatternRegex.exec(content)) !== null) {
        if (match[1] && match[1].trim()) ucioniceSet.add(match[1].trim());
      }
    } catch (err) {
      neuspelih++;
    }
  });

  if (neuspelih > 0) console.warn(`[IMI] ${neuspelih}/${JSON_DATASETS.length} skupova podataka nije preuzeto.`);
  return Array.from(ucioniceSet);
}

// Helper za dnevne rezervacije
async function fetchUcioniceIzDnevnihRezervacija() {
  const ucioniceSet = new Set();
  try {
    const [response, dayResponse] = await Promise.all([
      imiRequest('get', 'https://imi.pmf.kg.ac.rs/cp/rs/?pregled'),
      imiRequest('post', 'https://imi.pmf.kg.ac.rs/cp/rs/day.php')
    ]);
    const html = String(response.data);

    const optionRegex = /<option[^>]*>([^<]+)<\/option>/gi;
    let match;
    while ((match = optionRegex.exec(html)) !== null) {
      const naziv = match[1].trim();
      if (
        naziv &&
        !naziv.toLowerCase().includes('izaberi') &&
        !naziv.toLowerCase().includes('sve') &&
        !naziv.toLowerCase().includes('prikazi')
      ) {
        ucioniceSet.add(naziv);
      }
    }

    const dayHtml = String(dayResponse.data);
    const tableHeaderRegex = /<th[^>]*>([^<]+)<\/th>/gi;
    while ((match = tableHeaderRegex.exec(dayHtml)) !== null) {
      const nazivHeader = match[1].trim();
      if (nazivHeader && nazivHeader.length > 2 && !nazivHeader.includes(':')) {
        ucioniceSet.add(nazivHeader);
      }
    }
  } catch (error) {
    console.error('Greška u dnevnim rezervacijama:', error.message);
  }
  return Array.from(ucioniceSet);
}

// Učitava učionice iz baze (tabela Sala) - brz izvor dok sajt IMI ne odgovori ili je nedostupan
async function ucitajIzBaze() {
  const sale = await prisma.sala.findMany({ orderBy: { naziv: 'asc' } });
  cachedUcionice = sale.map((s) => ({ id: s.id, naziv: s.naziv }));
}

// Glavna funkcija za sinhronizaciju keša: povlači sa IMI sajta i čuva u tabelu Sala
async function syncUcioniceCache() {
  if (isFetching) return;
  isFetching = true;

  try {
    const [redovne, dnevne] = await Promise.all([
      fetchIzJsonDatasets(),
      fetchUcioniceIzDnevnihRezervacija()
    ]);

    const nazivi = [...new Set([...redovne, ...dnevne])];
    if (nazivi.length > 0) {
      await prisma.sala.createMany({ data: nazivi.map((naziv) => ({ naziv })), skipDuplicates: true });
      await ucitajIzBaze();
      console.log(`[Keš Osvežen] ${nazivi.length} učionica sa PMF sajta, ukupno u bazi ${cachedUcionice.length}.`);
    } else {
      console.warn('[Keš] IMI nije vratio učionice - zadržavam postojeće.');
    }
  } catch (error) {
    console.error('Greška pri osvežavanju keša učionica:', error.message);
  } finally {
    isFetching = false;
  }
}

// Poziva se iz server.js tek NAKON što server počne da sluša - ne usporava pokretanje.
function startUcioniceSync() {
  ucitajIzBaze().catch((e) => console.error('Greška pri čitanju učionica iz baze:', e.message));
  setTimeout(syncUcioniceCache, 3000);
  intervalId = setInterval(syncUcioniceCache, 6 * 60 * 60 * 1000);
  intervalId.unref();
}

// --- KONTROLERI ---

// GET /ucionice - Sve učionice (iz keša, a ako je prazan iz baze)
const getAllUcionice = async (req, res) => {
  try {
    if (cachedUcionice.length === 0) {
      await ucitajIzBaze();
    }
    res.set('Cache-Control', 'private, max-age=300');
    res.json(cachedUcionice);
  } catch (error) {
    console.error('Greška pri dohvatanju učionica:', error);
    res.status(500).json({ greska: 'Greška pri dohvatanju učionica.' });
  }
};

// GET /ucionice/dostupne?datum=2026-06-15&pocetak=09:00&kraj=11:00
// Sala je zauzeta ako u tom terminu postoji ispit u njoj ili redovna nastava (IMI).
const getDostupneUcionice = async (req, res) => {
  const { datum, pocetak, kraj } = req.query;

  if (!datum || !pocetak || !/^\d{4}-\d{2}-\d{2}$/.test(String(datum))) {
    return res.status(400).json({ greska: 'Datum (YYYY-MM-DD) i vreme početka su obavezni.' });
  }

  try {
    if (cachedUcionice.length === 0) {
      await ucitajIzBaze();
    }

    const dan = new Date(`${datum}T00:00:00.000Z`);
    const minuta = (t) => {
      const [h, m] = String(t).substring(0, 5).split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const od = minuta(pocetak);
    const doo = kraj ? minuta(kraj) : od + 120;

    const [ispiti, nastava] = await Promise.all([
      prisma.ispit.findMany({ where: { datum: dan, sala_id: { not: null } }, include: { sala: true } }),
      prisma.redovnaNastava.findMany({ where: { datum: dan }, include: { sala: true } })
    ]);

    const zauzeteSale = new Set();
    ispiti.forEach((i) => {
      const poc = minuta(String(i.vreme));
      const zav = i.vreme_kraja ? minuta(i.vreme_kraja.toISOString().substring(11, 16)) : poc + 120;
      if (poc < doo && zav > od) zauzeteSale.add(i.sala.naziv);
    });
    nastava.forEach((n) => {
      if (minuta(n.vreme_pocetka) < doo && minuta(n.vreme_kraja) > od) zauzeteSale.add(n.sala.naziv);
    });

    res.json(cachedUcionice.filter((sala) => !zauzeteSale.has(sala.naziv)));
  } catch (error) {
    console.error('Greška pri proveri dostupnosti:', error);
    res.status(500).json({ greska: 'Greška pri proveri dostupnosti učionica.' });
  }
};

module.exports = {
  getAllUcionice,
  getDostupneUcionice,
  startUcioniceSync
};
