const express = require('express');
const obavezaController = require('../controllers/obavezaController');
const router = express.Router();

// Dodat upitnik ? cini da ruta radi i za GET /obaveze i za GET /obaveze/3
router.get('/:saradnik_id?', obavezaController.getObaveze);
router.post('/', obavezaController.createObaveza);
router.delete('/:id', obavezaController.deleteObaveza);

module.exports = router;