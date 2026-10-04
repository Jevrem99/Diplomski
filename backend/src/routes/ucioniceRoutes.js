const express = require('express');
const router = express.Router();
const ucionicaController = require('../controllers/ucionicaController');
const { protect } = require('../middlewares/authMiddleware');

// Lista svih učionica
router.get('/', protect, ucionicaController.getAllUcionice);

// Lista dostupnih učionica za dati datum i termin
router.get('/dostupne', protect, ucionicaController.getDostupneUcionice);

module.exports = router;
