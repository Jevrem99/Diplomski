const prisma = require('../db/prisma');
const { syncZauzetostSala } = require('../services/imiSyncService');
const { ensureAdmin } = require('../db/ensureAdmin');
const { logAction } = require('../services/auditService');
const { napraviBackup } = require('../services/backupService');

// Reset je destruktivan, pa se traži eksplicitna potvrda u telu zahteva: { "confirm": "RESET" }
const RESET_CONFIRM = 'RESET';

const runImiSync = async (req, res) => {
    try {
        const rezultat = await syncZauzetostSala(req.body || {});
        await logAction(req.user?.username || 'Korisnik', 'SYNC', 'Redovna nastava', rezultat.poruka);
        res.status(200).json(rezultat);
    } catch (error) {
        console.error('Greška pri IMI sinhronizaciji:', error);
        res.status(500).json({ message: 'Greška pri obradi IMI podataka', error: error.message });
    }
};

const resetDatabase = async (req, res) => {
  if (!req.body || req.body.confirm !== RESET_CONFIRM) {
    return res.status(400).json({ message: `Za brisanje baze pošaljite { "confirm": "${RESET_CONFIRM}" }.` });
  }

  try {
    // Pre brisanja uvek se pravi rezervna kopija; ako ne uspe, brisanje se otkazuje
    let kopija;
    try {
      kopija = await napraviBackup('pre-reset');
    } catch (e) {
      console.error('Rezervna kopija nije napravljena:', e);
      return res.status(500).json({ message: 'Rezervna kopija nije napravljena, pa je brisanje otkazano.' });
    }

    const tables = await prisma['$queryRawUnsafe'](
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';"
    );

    if (tables && tables.length > 0) {
      const tableNames = tables.map(t => '"' + t.tablename + '"').join(', ');
      await prisma['$executeRawUnsafe']('TRUNCATE TABLE ' + tableNames + ' RESTART IDENTITY CASCADE;');
    }

    // Brisanje je obuhvatilo i tabelu korisnika - vraćamo admina da se niko ne zaključa iz sistema
    await ensureAdmin();
    await logAction(req.user?.username || 'Admin', 'RESET', 'Baza', 'Obrisani svi podaci iz baze');

    return res.status(200).json({ message: 'Baza podataka je obrisana (admin nalog je ponovo napravljen). Rezervna kopija: ' + require('path').basename(kopija) });
  } catch (error) {
    console.error('Greška pri resetovanju baze:', error);
    return res.status(500).json({ message: 'Greška pri brisanju baze podataka.' });
  }
};

module.exports = {
  resetDatabase,
  runImiSync
};
