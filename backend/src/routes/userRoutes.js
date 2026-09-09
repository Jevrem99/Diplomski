const express = require('express');
const userController = require('../controllers/userController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/change-password', protect, userController.changePassword);
router.get('/roles', protect, userController.getRoles);

router.post('/', protect, restrictToAdmin, userController.registerUser);
router.get('/', protect, restrictToAdmin, userController.getAllUsers);
router.get('/:id', protect, restrictToAdmin, userController.getUserById);
router.put('/:id', protect, restrictToAdmin, userController.updateUser);
router.delete('/:id', protect, restrictToAdmin, userController.deleteUser);

module.exports = router;