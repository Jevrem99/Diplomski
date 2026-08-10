const express = require('express');
const router = express.Router();
const ucionicaController = require('../controllers/ucionicaController');

// Lista svih učionica
router.get('/', ucionicaController.getAllUcionice);

// Lista dostupnih učionica za dati datum i termin
router.get('/dostupne', ucionicaController.getDostupneUcionice);

module.exports = router;