const express = require('express');
const obavezaController = require('../controllers/obavezaController');
const router = express.Router();

router.get('/:saradnik_id', obavezaController.getObaveze);
router.post('/', obavezaController.createObaveza);
router.delete('/:id', obavezaController.deleteObaveza);

module.exports = router;