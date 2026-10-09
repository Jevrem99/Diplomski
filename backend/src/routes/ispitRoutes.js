const express = require('express');
const ispitController = require('../controllers/ispitController');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// Glavni raspored menja samo admin; profesori i asistenti samo čitaju objavljene termine
const urednik = [protect, restrictTo('admin')];

// 1. FIKSNE RUTE MORAJU BITI NA VRHU
router.get('/stats', protect, ispitController.getDashboardStats);
router.get('/zauzeti-termini', protect, ispitController.getZauzetiTermini);
router.post('/proveri-konflikte', ...urednik, ispitController.proveriRaspored);
router.post('/bulk', ...urednik, ispitController.saveBulkIspiti);
router.put('/publish-all', ...urednik, ispitController.publishAll);
router.get('/rezervacije-sala', ...urednik, ispitController.getRezervacijeSala);

// 2. OSNOVNE GET I POST RUTE
router.get('/', protect, ispitController.getAllIspiti);
router.post('/', ...urednik, ispitController.createIspit);

// 3. RUTE SA PARAMETRIMA ID (MORAJU BITI NA SAMOM DNA)
router.get('/:id', protect, ispitController.getIspitById);
router.put('/:id', ...urednik, ispitController.updateIspit);
router.delete('/:id', ...urednik, ispitController.deleteIspit);
module.exports = router;
