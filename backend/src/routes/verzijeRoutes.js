const express = require('express');
const ctrl = require('../controllers/uvozController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(protect, restrictTo('admin'));

router.get('/', ctrl.listaVerzija);
router.post('/', ctrl.sacuvajVerziju);
router.get('/:id', ctrl.preuzmiVerziju);
router.post('/:id/pregled', ctrl.pregledVerzije);
router.delete('/:id', ctrl.obrisiVerziju);

module.exports = router;
