// npm run sale:spoji            -> pokaže šta bi se spojilo (ništa ne menja)
// npm run sale:spoji -- --yes   -> pravi rezervnu kopiju, pa spaja duple sale
// Duple sale su iste učionice zapisane na više načina ("A-0-15" i "A-0-15 RS", "A-II-24R" i "A-II-24r").
// Ispiti i redovna nastava se prebacuju na jednu salu, a višak se briše. Bezbedno je pokrenuti ponovo.
require('../src/config/config');
const prisma = require('../src/db/prisma');
const { normalizujNazivSale } = require('../src/utils/sale');
const { napraviBackup, zatvori } = require('../src/services/backupService');

(async () => {
    const primeni = process.argv.includes('--yes');
    try {
        const sale = await prisma.sala.findMany({ orderBy: { id: 'asc' } });
        const grupe = new Map();
        for (const s of sale) {
            const kljuc = normalizujNazivSale(s.naziv).toLowerCase();
            if (!grupe.has(kljuc)) grupe.set(kljuc, []);
            grupe.get(kljuc).push(s);
        }
        const zaSpajanje = [...grupe.values()].filter((g) => g.length > 1 || normalizujNazivSale(g[0].naziv) !== g[0].naziv);
        if (zaSpajanje.length === 0) { console.log('Nema duplih sala.'); return; }

        const plan = zaSpajanje.map((g) => {
            const cilj = normalizujNazivSale(g[0].naziv);
            const glavna = g.find((s) => s.naziv === cilj) || g[0];
            return { cilj, glavna, visak: g.filter((s) => s.id !== glavna.id) };
        });
        plan.forEach((p) => console.log(`${p.visak.map((s) => `"${s.naziv}"`).join(', ') || '(samo preimenovanje)'} -> "${p.cilj}"`));

        if (!primeni) { console.log('\nSamo pregled. Za izvršenje: npm run sale:spoji -- --yes'); return; }

        console.log('Rezervna kopija:', await napraviBackup('pre-spajanje-sala'));
        await prisma.$transaction(async (tx) => {
            for (const p of plan) {
                for (const v of p.visak) {
                    await tx.ispit.updateMany({ where: { sala_id: v.id }, data: { sala_id: p.glavna.id } });
                    await tx.redovnaNastava.updateMany({ where: { sala_id: v.id }, data: { sala_id: p.glavna.id } });
                    await tx.sala.delete({ where: { id: v.id } });
                }
                if (p.glavna.naziv !== p.cilj) await tx.sala.update({ where: { id: p.glavna.id }, data: { naziv: p.cilj } });
            }
        });
        console.log('Gotovo.');
    } catch (err) {
        console.error('Greška:', err.message);
        process.exitCode = 1;
    } finally {
        await zatvori();
    }
})();
