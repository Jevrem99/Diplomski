// Priprema bazu pri pokretanju (koristi se u Docker kontejneru, može i ručno: node scripts/pripremi-bazu.js).
//  - baza je prazna (nema tabele "User")  -> izvrši prisma/sema-od-nule.sql (cela šema)
//  - baza već ima podatke                 -> samo primeni prisma/dodaci-2026-10.sql (IF NOT EXISTS, ne menja podatke)
// Namerno bez "prisma migrate dev" i bez "--accept-data-loss": postojeći podaci se nikad ne diraju.
require('../src/config/config');
const path = require('path');
const { execFileSync } = require('child_process');
const prisma = require('../src/db/prisma');

const prisma_cli = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const schema = path.join(__dirname, '..', 'prisma', 'schema.prisma');

const izvrsi = (fajl) => {
    execFileSync(prisma_cli, ['db', 'execute', '--file', path.join(__dirname, '..', 'prisma', fajl), '--schema', schema], {
        stdio: 'inherit',
        shell: process.platform === 'win32'
    });
};

(async () => {
    try {
        const postoji = await prisma.$queryRaw`SELECT to_regclass('public."User"')::text AS tabela`; // ::text jer Prisma ne čita tip regclass
        if (postoji[0].tabela === null) {
            console.log('[baza] prazna baza: pravim tabele iz sema-od-nule.sql');
            izvrsi('sema-od-nule.sql');
        } else {
            console.log('[baza] tabele postoje: primenjujem samo dodatke seme (bezbedno, IF NOT EXISTS)');
            izvrsi('dodaci-2026-10.sql');
        }
        console.log('[baza] spremna');
    } catch (err) {
        console.error('[baza] greška pri pripremi baze:', err.message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
})();
