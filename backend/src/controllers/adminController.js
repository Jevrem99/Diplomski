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

    const tables = ['Predmet', 'Ispit','Profesor','Dezurstva']; 

    const tableNames = tables.map(t => `"${t}"`).join(', ');

    const query = `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`;

    console.log('Executing query:', query);

    return res.status(200).json({ 
      message: 'Baza je uspešno obrisana' 
    });

  } catch (error) {
    console.error('Greška pri pražnjenju Postgres baze:', error);
    return res.status(500).json({ 
      message: 'Greška na serveru prilikom pražnjenja baze.',
      error: error.message 
    });
  }
};

module.exports = {
  resetDatabase,
  runImiSync
};