const express = require('express');
const { importPredmetiExcel } = require('../controllers/excelUploadController.js');
const { uploadExcel } = require('../middlewares/uploadMiddleware.js');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware.js');

const router = express.Router();

// Samo ulogovani korisnici koji su ADMIN mogu da uvoze Excel!
router.post('/import-excel', protect, restrictToAdmin, uploadExcel.single('excelFile'), importPredmetiExcel);

module.exports = router;