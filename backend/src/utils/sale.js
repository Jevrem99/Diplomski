// Jedinstveno ime učionice. IMI sajt, ručni unos i stari podaci pišu istu salu na više načina
// ("A-0-15" / "A-0-15 RS", "A-II-24R" / "A-II-24r"), pa se svi nazivi svode na isti oblik.
// "A-II-24R" i "A-II-24" ostaju različite sale (slovo na kraju je deo imena).
const normalizujNazivSale = (naziv) => {
    let n = String(naziv ?? '').replace(/\s+/g, ' ').trim();
    n = n.replace(/\s+RS$/i, '');                 // oznaka "računarska sala" nije deo imena sale
    n = n.replace(/(\d)([a-z])$/, (_, c, s) => c + s.toUpperCase()); // 24r -> 24R
    return n;
};

// Vraća salu sa tim nazivom (bez obzira na velika/mala slova) ili je pravi.
// cache (Map) izbegava ponovljene upite u petlji; db može biti prisma ili transakcija.
const nadjiIliNapraviSalu = async (db, naziv, cache = new Map()) => {
    const n = normalizujNazivSale(naziv);
    if (!n) return null;
    const kljuc = n.toLowerCase();
    if (cache.has(kljuc)) return cache.get(kljuc);
    let sala = await db.sala.findFirst({ where: { naziv: { equals: n, mode: 'insensitive' } } });
    if (!sala) sala = await db.sala.create({ data: { naziv: n } });
    cache.set(kljuc, sala);
    return sala;
};

module.exports = { normalizujNazivSale, nadjiIliNapraviSalu };
