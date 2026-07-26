const express = require('express');
const profesorController = require('../controllers/profesorController');

const router = express.Router();

router.get('/', profesorController.getAllProfesors);
router.get('/:id', profesorController.getProfesorById);
router.post('/', profesorController.createProfesor);
router.put('/:id', profesorController.updateProfesor);
router.delete('/:id', profesorController.deleteProfesor);

module.exports = router;