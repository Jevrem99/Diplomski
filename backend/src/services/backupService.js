const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Rezervne kopije se čuvaju kao JSON (ne zavise od pg_dump alata). Folder je van git-a jer sadrži
// i heširane lozinke korisnika - čuvajte ga kao i samu bazu.
const BACKUP_DIR = path.join(__dirname, '../../backups');
const ZADRZI_POSLEDNJIH = 15;

// Redosled je bitan pri vraćanju (roditelji pre dece)
const TABELE = [
    ['sala', 'sala'],
    ['profesor', 'profesor'],
    ['user', 'user'],
    ['predmet', 'predmet'],
    ['ispit', 'ispit'],
    ['dezurstva', 'dezurstva'],
    ['obaveza', 'obaveza'],
    ['redovnaNastava', 'redovnaNastava'],
    ['terminKolokvijuma', 'terminKolokvijuma'],
    ['auditLog', 'auditLog'],
    ['zahtevZamene', 'zahtevZamene']
];
const SQL_IMENA = {
    sala: 'Sala', profesor: 'Profesor', user: 'User', predmet: 'Predmet', ispit: 'Ispit', dezurstva: 'Dezurstva',
    obaveza: 'Obaveza', redovnaNastava: 'RedovnaNastava', terminKolokvijuma: 'TerminKolokvijuma',
    auditLog: 'AuditLog', zahtevZamene: 'ZahtevZamene'
};

// Poseban klijent BEZ ekstenzije iz db/prisma.js (ona pretvara datum/vreme u tekst), da kopija ostane verna bazi
let raw = null;
const prisma = new Proxy({}, {
    get: (_, ime) => {
        if (!raw) raw = new PrismaClient();
        return raw[ime];
    }
});
const sirovi = (ime) => prisma[ime];
const zatvori = async () => { if (raw) await raw.$disconnect(); };

async function napraviBackup(razlog = 'rucno') {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const podaci = {};
    for (const [kljuc, delegat] of TABELE) {
        podaci[kljuc] = await sirovi(delegat).findMany();
    }
    // veza predmet <-> saradnici (m:n tabela)
    const predmetiSaSaradnicima = await prisma.predmet.findMany({ select: { id: true, saradnici: { select: { id: true } } } });
    podaci._predmetSaradnici = predmetiSaSaradnicima.map((p) => ({ predmet_id: p.id, saradnici: p.saradnici.map((s) => s.id) }));

    const zig = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fajl = path.join(BACKUP_DIR, `backup-${zig}-${razlog}.json`);
    fs.writeFileSync(fajl, JSON.stringify({ verzija: 1, napravljeno: new Date().toISOString(), podaci }));

    // Čuvamo samo poslednjih N kopija
    const sve = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('backup-') && f.endsWith('.json')).sort();
    sve.slice(0, Math.max(0, sve.length - ZADRZI_POSLEDNJIH)).forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)));

    return fajl;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const reviver = (k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v);

// VRAĆA bazu na stanje iz kopije: briše sve trenutne podatke i upisuje podatke iz fajla.
async function vratiBackup(fajl) {
    const { podaci } = JSON.parse(fs.readFileSync(fajl, 'utf-8'), reviver);

    const imena = TABELE.map(([k]) => `"${SQL_IMENA[k]}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${imena} RESTART IDENTITY CASCADE;`);

    for (const [kljuc, delegat] of TABELE) {
        const redovi = podaci[kljuc] || [];
        if (redovi.length) await sirovi(delegat).createMany({ data: redovi });
    }
    for (const v of podaci._predmetSaradnici || []) {
        if (v.saradnici.length) {
            await prisma.predmet.update({ where: { id: v.predmet_id }, data: { saradnici: { connect: v.saradnici.map((id) => ({ id })) } } });
        }
    }
    // brojači id-jeva posle ručnog upisa id vrednosti
    for (const [kljuc] of TABELE) {
        const t = SQL_IMENA[kljuc];
        await prisma.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 0) + 1, false);`
        );
    }
}

function izlistajBackupe() {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
}

module.exports = { napraviBackup, vratiBackup, izlistajBackupe, zatvori, BACKUP_DIR };
