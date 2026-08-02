const express = require('express');
const userModel = require('../models/userModel');
const userController = require('../controllers/userController');
//const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', userController.registerUser); // Promenjeno sa /register na /
router.get('/', userController.getAllUsers);
router.get('/roles', userController.getRoles);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;