const pool = require('../db/connection');

const resetDatabase = async (req, res) => {
  try {

    const tables = ['predmet', 'ispit','profesor','dezurstva']; 

    const tableNames = tables.map(t => `"${t}"`).join(', ');

    const query = `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`;

    await pool.query(query);

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
  resetDatabase
};