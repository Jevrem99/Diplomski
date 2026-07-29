const express = require('express');
const predmetController = require('../controllers/predmetController');

const router = express.Router();

router.get('/', predmetController.getAllPredmets);
router.get('/:id', predmetController.getPredmetById);
router.post('/', predmetController.createPredmet);
router.put('/:id', predmetController.updatePredmet);
router.delete('/:id', predmetController.deletePredmet);

module.exports = router;