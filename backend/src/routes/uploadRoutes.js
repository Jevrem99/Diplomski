const express = require('express');
const { importPredmetiExcel } = require('../controllers/excelUploadController.js');
const { uploadExcel } = require('../middlewares/uploadMiddleware.js');

const router = express.Router();

router.post('/import-excel', uploadExcel.single('excelFile'), importPredmetiExcel);

module.exports = router;