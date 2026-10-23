const express = require('express');
const ctrl = require('../controllers/integracijaPodesavanjaController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(protect, restrictToAdmin);

router.get('/', ctrl.getStanje);
router.post('/kljuc', ctrl.noviKljuc);
router.delete('/kljuc', ctrl.ukloniKljuc);
router.put('/slanje', ctrl.postaviSlanje);
router.post('/slanje/neposlate', ctrl.neposlate);

module.exports = router;
