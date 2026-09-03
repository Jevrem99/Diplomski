const axios = require('axios');
const https = require('https');

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

const JSON_DATASETS = [
  'IgodMatLet15.js', 'IIgodMatLet15_pm.js', 'IIgodMatLet15_ripm.js', 'IIgodMatLet15_tmip.js',
  'IIIgodMatLet15_pm.js', 'IIIgodMatLet15_tm.js', 'IIIgodMatLet15_tmip.js', 'IVgodMatLet15_pm.js',
  'IVgodMatLet15_tm.js', 'IVgodMatLet15_tt.js', 'MasMatLet15_pm.js', 'MasMatLet15_tm.js',
  'MasMatLet15_rm.js', 'IgodInfLet15.js', 'IIgodInfLet15_ikt.js', 'IIgodInfLet15_rn.js',
  'IIgodInfLet15_si.js', 'IIIgodInfLet15_rns.js', 'IIIgodInfLet15_rn.js', 'IIIgodInfLet15_si.js',
  'IVgodInfLet15_pi.js', 'IVgodInfLet15_ri.js', 'IVgodInfLet15_si.js', 'MasInfLet15.js', 'MasInfLet15rn.js'
];

async function fetchIzJsonDatasets() {
  const ucioniceSet = new Set();
  const baseUrl = 'https://imi.pmf.kg.ac.rs/json_datasets/';

  for (const file of JSON_DATASETS) {
    try {
      const response = await axiosInstance.get(`${baseUrl}${file}`);
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
    } catch (err) {}
  }
  return Array.from(ucioniceSet);
}

async function fetchUcioniceIzDnevnihRezervacija() {
  const ucioniceSet = new Set();
  try {
    const response = await axiosInstance.get('https://imi.pmf.kg.ac.rs/cp/rs/?pregled');
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

    const dayResponse = await axiosInstance.post('https://imi.pmf.kg.ac.rs/cp/rs/day.php');
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

// GET /ucionice - Sve učionice
const getAllUcionice = async (req, res) => {
  try {
    const ucioniceSet = new Set();

    const [redovne, dnevne] = await Promise.all([
      fetchIzJsonDatasets(),
      fetchUcioniceIzDnevnihRezervacija()
    ]);

    redovne.forEach(u => ucioniceSet.add(u));
    dnevne.forEach(u => ucioniceSet.add(u));

    const result = Array.from(ucioniceSet)
      .sort((a, b) => a.localeCompare(b, 'sr'))
      .map((u, i) => ({ id: i + 1, naziv: u }));

    res.json(result);
  } catch (error) {
    console.error('Greška pri dohvatanju učionica:', error);
    res.status(500).json({ greska: 'Greška pri dohvatanju učionica.' });
  }
};

// GET /ucionice/dostupne?datum=2026-06-15&pocetak=09:00&kraj=11:00
const getDostupneUcionice = async (req, res) => {
  const { datum, pocetak, kraj } = req.query;

  if (!datum || !pocetak) {
    return res.status(400).json({ greska: 'Datum i vreme početka su obavezni.' });
  }

  try {
    // 1. Dohvatimo sve učionice
    const sveUcioniceSet = new Set([
      ...(await fetchIzJsonDatasets()),
      ...(await fetchUcioniceIzDnevnihRezervacija())
    ]);

    // 2. Proverimo vaše ispite u bazi za taj datum (Prisma primer)
    /*
    const zauzetiIspiti = await prisma.ispit.findMany({
      where: {
        datum: datum,
        // logika preklapanja satnice
      },
      select: { sala: true }
    });
    const zauzeteSale = new Set(zauzetiIspiti.map(i => i.sala));
    */

    // Prilagodite prema vašoj bazi/logici preklapanja:
    const zauzeteSale = new Set(); 

    const dostupne = Array.from(sveUcioniceSet)
      .filter(sala => !zauzeteSale.has(sala))
      .sort((a, b) => a.localeCompare(b, 'sr'))
      .map((u, i) => ({ id: i + 1, naziv: u }));

    res.json(dostupne);
  } catch (error) {
    console.error('Greška pri proveri dostupnosti:', error);
    res.status(500).json({ greska: 'Greška pri proveri dostupnosti učionica.' });
  }
};

module.exports = {
    getAllUcionice,
    getDostupneUcionice
}