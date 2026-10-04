const express = require('express');
const zameneController = require('../controllers/zameneController');
const { protect, restrictToAdmin, restrictTo } = require('../middlewares/authMiddleware');
const router = express.Router();

// Asistent / profesor (administrator nema sopstvena dežurstva)
const saradnik = [protect, restrictTo('asistent', 'profesor')];
router.get('/moje', ...saradnik, zameneController.mojiZahtevi);
router.get('/kolege/:dezurstvo_id', ...saradnik, zameneController.getKolege);
router.post('/', ...saradnik, zameneController.napraviZahtev);
router.delete('/:id', ...saradnik, zameneController.otkaziZahtev);

// Administrator
router.get('/', protect, restrictToAdmin, zameneController.sviZahtevi);
router.get('/:id/kandidati', protect, restrictToAdmin, zameneController.kandidati);
router.post('/:id/odobri', protect, restrictToAdmin, zameneController.odobri);
router.post('/:id/odbij', protect, restrictToAdmin, zameneController.odbij);

module.exports = router;
