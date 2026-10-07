// Automatska noćna sinhronizacija redovne nastave sa IMI sajta.
//  - svake noći u NOCNI_SYNC_SAT (podrazumevano 3:00) po vremenu servera
//  - pri pokretanju servera, ako poslednja sinhronizacija nije bila u poslednja 24 sata
//    (npr. računar je bio ugašen u 3:00)
// Isključivanje: NOCNI_SYNC=false u .env
const prisma = require('../db/prisma');
const { syncZauzetostSala } = require('./imiSyncService');
const { logAction } = require('./auditService');

const DAN_MS = 24 * 60 * 60 * 1000;
let tajmer = null;

const sledeciTermin = (sat) => {
    const t = new Date();
    t.setHours(sat, 0, 0, 0);
    if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
    return t;
};

const pokreniSync = async (izvor) => {
    try {
        const rezultat = await syncZauzetostSala({});
        await logAction('Sistem', 'SYNC', 'Redovna nastava', `${izvor}: ${rezultat.poruka}`);
        console.log(`[IMI sync] ${izvor}: ${rezultat.poruka}`);
    } catch (err) {
        await logAction('Sistem', 'SYNC', 'Redovna nastava', `${izvor}: NEUSPEH - ${err.message}`);
        console.error(`[IMI sync] ${izvor}: neuspeh -`, err.message);
    }
};

const zakazi = (sat) => {
    const kada = sledeciTermin(sat);
    tajmer = setTimeout(async () => {
        await pokreniSync('noćna sinhronizacija');
        zakazi(sat);
    }, kada.getTime() - Date.now());
    tajmer.unref();
    console.log(`[IMI sync] sledeća automatska sinhronizacija: ${kada.toLocaleString('sr-RS')}`);
};

const startNocniSync = async () => {
    if (String(process.env.NOCNI_SYNC).toLowerCase() === 'false') {
        console.log('[IMI sync] automatska sinhronizacija je isključena (NOCNI_SYNC=false).');
        return;
    }
    const sat = Number.isInteger(Number(process.env.NOCNI_SYNC_SAT)) && process.env.NOCNI_SYNC_SAT !== ''
        ? Math.min(Math.max(Number(process.env.NOCNI_SYNC_SAT), 0), 23) : 3;
    zakazi(sat);

    try {
        const poslednja = await prisma.auditLog.findFirst({
            where: { akcija: 'SYNC', entitet: 'Redovna nastava', NOT: { detalji: { contains: 'NEUSPEH' } } },
            orderBy: { created_at: 'desc' }
        });
        if (!poslednja || Date.now() - poslednja.created_at.getTime() > DAN_MS) {
            const t = setTimeout(() => pokreniSync('nadoknada pri pokretanju'), 20_000); // da start servera ne čeka
            t.unref();
        }
    } catch (err) {
        console.error('[IMI sync] provera poslednje sinhronizacije nije uspela:', err.message);
    }
};

module.exports = { startNocniSync };
