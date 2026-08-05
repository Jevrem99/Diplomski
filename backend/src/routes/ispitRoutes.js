const express = require('express');
const ispitController = require('../controllers/ispitController');
const { getDashboardStats } = require('../controllers/ispitController');
const router = express.Router();

// 1. FIKSNE RUTE MORAJU BITI NA VRHU
router.get('/stats', getDashboardStats);
router.get('/zauzeti-termini', ispitController.getZauzetiTermini);
router.post('/bulk', ispitController.saveBulkIspiti);
router.put('/publish-all', ispitController.publishAll); 

// 2. OSNOVNE GET I POST RUTE
router.get('/', ispitController.getAllIspiti);
router.post('/', ispitController.createIspit);

// 3. RUTE SA PARAMETRIMA ID (MORAJU BITI NA SAMOM DNA)
router.get('/:id', ispitController.getIspitById);
router.put('/:id', ispitController.updateIspit);
router.delete('/:id', ispitController.deleteIspit);

module.exports = router;