const express = require('express');
const profesorController = require('../controllers/profesorController');

const router = express.Router();

// GET rute (ostaju iste)
router.get('/', profesorController.getAllPredavaci);
router.get('/saradnici', profesorController.getAllSaradnici);
router.get('/profesori', profesorController.getAllProfesori);
router.get('/:id', profesorController.getProfesorById);

// PROFESORI MUTACIJE (is_saradnik = false)
router.post('/profesori', (req, res, next) => { req.body.is_saradnik = false; next(); }, profesorController.createProfesor);
router.put('/profesori/:id', (req, res, next) => { req.body.is_saradnik = false; next(); }, profesorController.updateProfesor);
router.delete('/profesori/:id', profesorController.deleteProfesor);

// SARADNICI MUTACIJE (is_saradnik = true) - OVO JE FALILO!
router.post('/saradnici', (req, res, next) => { req.body.is_saradnik = true; next(); }, profesorController.createProfesor);
router.put('/saradnici/:id', (req, res, next) => { req.body.is_saradnik = true; next(); }, profesorController.updateProfesor);
router.delete('/saradnici/:id', profesorController.deleteProfesor);

module.exports = router;