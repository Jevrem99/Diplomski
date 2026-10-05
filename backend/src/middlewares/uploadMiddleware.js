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

module.exports = {
  uploadExcel
};
