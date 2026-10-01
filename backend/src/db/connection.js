const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://\({process.env.DB_USER || 'postgres'}:\){process.env.DB_PASSWORD || 'postgres'}@\({process.env.DB_HOST || 'localhost'}:\){process.env.DB_PORT || 8000}/${process.env.DB_NAME || 'diplomski'}`
});

// Provera konekcije uz OBAVEZNO oslobađanje klijenta nazad u pool
pool.connect((err, client, release) => {
    if (err) {
        console.error('Connection error', err.stack);
        return;
    }
    console.log('Connected to PostgreSQL');
    release(); // <-- OVO JE KLJUČNO: vraća klijenta u pool da ne ostane zagušen
});

module.exports = pool;