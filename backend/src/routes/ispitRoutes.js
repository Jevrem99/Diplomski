const express = require('express');
const ispitController = require('../controllers/ispitController');
const { getDashboardStats } = require('../controllers/ispitController');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
// 1. FIKSNE RUTE MORAJU BITI NA VRHU
router.get('/stats', getDashboardStats);
router.get('/zauzeti-termini', ispitController.getZauzetiTermini);
router.post('/bulk',protect, ispitController.saveBulkIspiti);
router.put('/publish-all',protect, ispitController.publishAll); 

// 2. OSNOVNE GET I POST RUTE
router.get('/', ispitController.getAllIspiti);
router.post('/',protect, ispitController.createIspit);

// 3. RUTE SA PARAMETRIMA ID (MORAJU BITI NA SAMOM DNA)
router.get('/:id', ispitController.getIspitById);
router.put('/:id', protect,ispitController.updateIspit);
router.delete('/:id', protect,ispitController.deleteIspit);

module.exports = router;