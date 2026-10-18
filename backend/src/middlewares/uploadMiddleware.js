const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.mimetype === 'application/vnd.ms-excel'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Dozvoljeni su samo Excel (.xlsx, .xls) fajlovi!'), false);
  }
};

// Fajl se čuva u memoriji, zato ograničavamo veličinu (10 MB je mnogo više od stvarnog rasporeda)
const uploadExcel = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

// Uvoz rasporeda: Excel ili JSON (prepoznaje se i po nastavku, jer pregledači šalju različite tipove za .json)
const fileFilterUvoz = (req, file, cb) => {
  const ime = String(file.originalname || '').toLowerCase();
  if (ime.endsWith('.xlsx') || ime.endsWith('.json')) cb(null, true);
  else cb(new Error('Dozvoljeni su samo .xlsx i .json fajlovi!'), false);
};
const uploadUvoz = multer({ storage, fileFilter: fileFilterUvoz, limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

module.exports = {
  uploadExcel,
  uploadUvoz
};
