const express = require('express');
const grupaController = require('../controllers/grupaController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Grupe predmeta pravi i koristi samo administrator (u banci predmeta na stranici Raspored)
router.get('/', protect, restrictToAdmin, grupaController.getGrupe);
router.post('/', protect, restrictToAdmin, grupaController.createGrupa);
router.put('/:id', protect, restrictToAdmin, grupaController.updateGrupa);
router.delete('/:id', protect, restrictToAdmin, grupaController.deleteGrupa);

module.exports = router;
