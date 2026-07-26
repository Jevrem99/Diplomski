const express = require('express');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.post('/reset-database', adminController.resetDatabase);
router.post('/insert-test-data', adminController.insertTestData);

module.exports = router;