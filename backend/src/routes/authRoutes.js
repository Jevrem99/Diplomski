const express = require('express');
const authController = require('../controllers/authController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/login', authController.loginUser);
router.get('/pmf-podesavanja', authController.pmfPodesavanja);
router.post('/pmf', authController.pmfLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/admin-reset-password', protect, restrictToAdmin, authController.adminResetPassword);

module.exports = router;