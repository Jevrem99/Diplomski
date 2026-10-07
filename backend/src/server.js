const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');
const prisma = require('./db/prisma');
const { ensureAdmin } = require('./db/ensureAdmin');
const { startUcioniceSync } = require('./controllers/ucionicaController');
const { startNocniSync } = require('./services/nocniSync');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const profesorRoutes = require('./routes/profesorRoutes');
const predmetRoutes = require('./routes/predmetRoutes');
const ispitRoutes = require('./routes/ispitRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const dezurstvaRoutes = require('./routes/dezurstvaRoutes');
const obavezaRoutes = require('./routes/obavezaRoutes');
const ucionicaRoutes = require('./routes/ucioniceRoutes');
const terminiKolokvijumaRoutes = require('./routes/terminiKolokvijumaRoutes');
const zameneRoutes = require('./routes/zameneRoutes');
const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition']
}));

app.use(express.json({ limit: '5mb' }));

// Ograničenje pokušaja prijave / resetovanja lozinke (zaštita od pogađanja lozinki)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Previše pokušaja. Pokušajte ponovo za nekoliko minuta.' }
});
app.use('/auth/login', authLimiter);
app.use('/auth/forgot-password', authLimiter);
app.use('/auth/reset-password', authLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/profesors', profesorRoutes);
app.use('/predmet', predmetRoutes);
app.use('/ispit', ispitRoutes);
app.use('/admin', adminRoutes);
app.use('/upload', uploadRoutes);
app.use('/dezurstva', dezurstvaRoutes);
app.use('/obaveze', obavezaRoutes);
app.use('/ucionice', ucionicaRoutes);
app.use('/termini-kolokvijuma', terminiKolokvijumaRoutes);
app.use('/zamene', zameneRoutes);

// 404 + centralni handler grešaka (npr. multer: prevelik fajl, pogrešan tip fajla)
app.use((req, res) => res.status(404).json({ message: 'Ruta ne postoji.' }));
app.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Fajl je prevelik (maksimum 10 MB).' });
    }
    if (err && err.message && err.message.startsWith('Dozvoljeni su samo')) {
        return res.status(400).json({ message: err.message });
    }
    console.error('Neobrađena greška:', err);
    res.status(err.status || 500).json({ message: 'Greška na serveru.' });
});

const server = app.listen(config.port, async () => {
    console.log(`Server is running on port ${config.port}`);
    try {
        await ensureAdmin(); // pravi admin nalog ako ga nema (vidi src/db/ensureAdmin.js)
    } catch (err) {
        console.error('Neuspelo proveravanje admin naloga (da li je baza dostupna?):', err.message);
    }
    startUcioniceSync(); // pozadinski, ne blokira pokretanje
    startNocniSync(); // automatska noćna sinhronizacija redovne nastave (vidi services/nocniSync.js)
});

const ugasi = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
};
process.on('SIGINT', ugasi);
process.on('SIGTERM', ugasi);
