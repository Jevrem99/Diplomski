const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

// Tajni ključ za JWT mora biti postavljen u .env - nema "rezervne" vrednosti u kodu
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('GREŠKA: JWT_SECRET nije podešen u .env (min. 16 karaktera). Pogledaj .env.example.');
    process.exit(1);
}

const config = {
    port: process.env.PORT || 5000,
    secret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    isProduction,
    // Adresa frontenda: koristi se za CORS i za link u mejlu za reset lozinke
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    // Podrazumevani admin koji se pravi pri pokretanju ako admina nema (vidi src/db/ensureAdmin.js)
    admin: {
        username: process.env.ADMIN_USERNAME || 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@pmf.kg.ac.rs',
        password: process.env.ADMIN_PASSWORD || null
    }
};

module.exports = config;
