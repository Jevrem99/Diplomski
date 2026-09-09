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

const insertTestData = async (req, res) => {
  try {
    const testData = {
      profesori: [
        { ime: 'Proba', prezime: 'Probic', is_saradnik: false, email: 'proba@gmail.com' },
        { ime: 'Nikola', prezime: 'Jevremovic', is_saradnik: true, email: 'n.jevremovic@gmail.com' },
        { ime: 'Luka', prezime: 'Vuksanovic', is_saradnik: true, email: 'l.vuksanovic@gmail.com' },
        { ime: 'Visnja', prezime: 'Simic', is_saradnik: false, email: 'v.simic@gmail.com' },
        { ime: 'Tatjana', prezime: 'Stojanovic', is_saradnik: false, email: 't.stojanovic@gmail.com' }
      ],
      predmeti: [
        { naziv: 'Osnivi probe 1', godina: 1, semestar: 'zimski', status: 'I', sifra: 'PROBA75', profesor_id: 1 },
        { naziv: 'Računarski sistemi', godina: 1, semestar: 'zimski', status: 'O', sifra: '19.INF034', profesor_id: 4 },
        { naziv: 'Strukture podataka i algoritmi', godina: 1, semestar: 'letnji', status: 'O', sifra: '19.INF037', profesor_id: 5 },
        { naziv: 'Uvod u veštačku inteligenciju', godina: 3, semestar: 'zimski', status: 'O', sifra: '19.IN1027', profesor_id: 4 },
        { naziv: 'Logičko i funkcijsko programiranje', godina: 3, semestar: 'letnji', status: 'O', sifra: '19.FI2023', profesor_id: 5 }
      ],
      ispiti: [
        { predmet_id: 1, datum: new Date('2026-08-15'), vreme: new Date('2026-08-15T08:00:00Z'), is_ispit: true },
        { predmet_id: 2, datum: new Date('2026-08-02'), vreme: new Date('2026-08-02T09:00:00Z'), is_ispit: true },
        { predmet_id: 3, datum: new Date('2026-08-10'), vreme: new Date('2026-08-10T14:00:00Z'), is_ispit: true },
        { predmet_id: 4, datum: new Date('2026-07-29'), vreme: new Date('2026-07-29T10:00:00Z'), is_ispit: true },
        { predmet_id: 5, datum: new Date('2026-07-24'), vreme: new Date('2026-07-24T09:00:00Z'), is_ispit: true }
      ]
    };

    await prisma.$transaction(async (tx) => {
      
      for (const profesor of testData.profesori) {
        await tx.profesor.create({ data: profesor });
      }

      for (const predmet of testData.predmeti) {
        await tx.predmet.create({ data: predmet });
      }

      for (const ispit of testData.ispiti) {
        await tx.ispit.create({ data: ispit });
      }
    });

    return res.status(200).json({
      message: 'Test podaci su uspešno ubačeni u bazu.'
    });
  } catch (error) {
    console.error('Greška pri ubacivanju test podataka:', error);
    return res.status(500).json({
      message: 'Greška na serveru prilikom ubacivanja test podataka.',
      error: error.message
    });
  }
};


module.exports = {
  resetDatabase,
  insertTestData,
  runImiSync
};