const express = require('express');
const router = express.Router();
const terminiController = require('../controllers/terminiKolokvijumaController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

// 1. Pregled sopstvenih predmeta (za nastavno osoblje / asistente)
router.get('/moji', protect, terminiController.getMojiTermini);

// 2. Čuvanje unetih termina za kolokvijume
router.post('/sacuvaj', protect, terminiController.saveTermini);

// 3. Generisanje i preuzimanje Excel izveštaja (npr. samo za admina / rukovodioce)
router.get('/export-excel', protect, restrictToAdmin, terminiController.exportExcel);

module.exports = router;