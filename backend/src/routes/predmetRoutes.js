const express = require('express');
const predmetController = require('../controllers/predmetController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, predmetController.getAllPredmets);
router.get('/:id', protect, predmetController.getPredmetById);
router.post('/', protect, restrictToAdmin, predmetController.createPredmet);
router.put('/:id', protect, restrictToAdmin, predmetController.updatePredmet);
router.delete('/:id', protect, restrictToAdmin, predmetController.deletePredmet);

module.exports = router;
