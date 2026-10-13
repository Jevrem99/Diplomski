const express = require('express');
const rateLimit = require('express-rate-limit');
const { apiKljuc } = require('../middlewares/apiKljuc');
const integracijeController = require('../controllers/integracijeController');

const router = express.Router();

// Preuzimanje je čitanje celog snimka; 120 poziva u 15 minuta je mnogo više nego što je potrebno
const ogranicenje = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Previše poziva. Pokušajte ponovo za nekoliko minuta.' }
});

router.get('/rezervacije-sala', ogranicenje, apiKljuc, integracijeController.getRezervacijeSala);

module.exports = router;
