const express = require('express');
const profesorController = require('../controllers/profesorController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

const jeSaradnik = (vrednost) => (req, res, next) => { req.body.is_saradnik = vrednost; next(); };

// GET rute: svaki ulogovani korisnik
router.get('/', protect, profesorController.getAllPredavaci);
router.get('/saradnici', protect, profesorController.getAllSaradnici);
router.get('/profesori', protect, profesorController.getAllProfesori);
router.get('/:id', protect, profesorController.getProfesorById);

// PROFESORI MUTACIJE (is_saradnik = false) - samo admin
router.post('/profesori', protect, restrictToAdmin, jeSaradnik(false), profesorController.createProfesor);
router.put('/profesori/:id', protect, restrictToAdmin, jeSaradnik(false), profesorController.updateProfesor);
router.delete('/profesori/:id', protect, restrictToAdmin, profesorController.deleteProfesor);

// SARADNICI MUTACIJE (is_saradnik = true) - samo admin
router.post('/saradnici', protect, restrictToAdmin, jeSaradnik(true), profesorController.createProfesor);
router.put('/saradnici/:id', protect, restrictToAdmin, jeSaradnik(true), profesorController.updateProfesor);
router.delete('/saradnici/:id', protect, restrictToAdmin, profesorController.deleteProfesor);

module.exports = router;
