const {Pool} = require('pg')

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'diplomski',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 8000,
});

pool.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Connection error', err));

module.exports = pool;