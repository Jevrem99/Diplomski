const express = require('express');
const ispitController = require('../controllers/ispitController');

const router = express.Router();

router.get('/', ispitController.getAllIspiti);
router.get('/:id', ispitController.getIspitById);
router.post('/', ispitController.createIspit);
router.put('/:id', ispitController.updateIspit);
router.delete('/:id', ispitController.deleteIspit);

module.exports = router;