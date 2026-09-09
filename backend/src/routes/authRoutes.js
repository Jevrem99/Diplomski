const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

router.post('/login', authController.loginUser);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;