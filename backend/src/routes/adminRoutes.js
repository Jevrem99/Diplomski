const express = require('express');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.post('/reset-database', adminController.resetDatabase);

module.exports = router;