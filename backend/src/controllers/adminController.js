const pool = require('../db/connection');
const prisma = require('../db/prisma');
const { syncZauzetostSala } = require('../services/imiSyncService');

const runImiSync = async (req, res) => {
    try {
        const rezultat = await syncZauzetostSala();
        res.status(200).json(rezultat);
    } catch (error) {
        console.error('Greška pri IMI sinhronizaciji:', error);
        res.status(500).json({ message: 'Greška pri obradi IMI podataka', error: error.message });
    }
};
const resetDatabase = async (req, res) => {
  try {
    const tables = await prisma['$queryRawUnsafe'](
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';"
    );

    if (tables && tables.length > 0) {
      const tableNames = tables.map(t => '"' + t.tablename + '"').join(', ');
      await prisma['$executeRawUnsafe']('TRUNCATE TABLE ' + tableNames + ' RESTART IDENTITY CASCADE;');
    }

    return res.status(200).json({ message: 'Baza podataka je uspešno i potpuno obrisana!' });
  } catch (error) {
    console.error('Greška pri resetovanju baze:', error);
    return res.status(500).json({ 
      message: 'Greška pri brisanju baze podataka.', 
      error: error.message 
    });
  }
};
module.exports = {
  resetDatabase,
  runImiSync
};