import express from 'express';
import { importPredmetiExcel } from '../controllers/excelUploadController.js';
import { uploadExcel } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// 'excelFile' je IME KLJUČA koji šalješ sa frontenda u FormData!
router.post('/import-excel', uploadExcel.single('excelFile'), importPredmetiExcel);

export default router;