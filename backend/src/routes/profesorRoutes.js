const express = require('express');
const profesorController = require('../controllers/profesorController');

const router = express.Router();

router.get('/', profesorController.getAllPredavaci);
router.get('/saradnici', profesorController.getAllSaradnici);
router.get('/profesori', profesorController.getAllProfesori);
router.get('/:id', profesorController.getProfesorById);
router.post('/', profesorController.createProfesor);
router.put('/:id', profesorController.updateProfesor);
router.delete('/:id', profesorController.deleteProfesor);

module.exports = router;