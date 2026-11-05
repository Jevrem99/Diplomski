const express = require('express');
const router = express.Router();
const ucionicaController = require('../controllers/ucionicaController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

// Lista svih učionica
router.get('/', protect, ucionicaController.getAllUcionice);

// Lista dostupnih učionica za dati datum i termin
router.get('/dostupne', protect, ucionicaController.getDostupneUcionice);

// Upravljanje salama (Upravljaj bazom → Sale)
router.get('/sale', protect, restrictToAdmin, ucionicaController.getSale);
router.post('/sale', protect, restrictToAdmin, ucionicaController.createSala);
router.put('/sale/:id', protect, restrictToAdmin, ucionicaController.updateSala);
router.delete('/sale/:id', protect, restrictToAdmin, ucionicaController.deleteSala);

module.exports = router;
