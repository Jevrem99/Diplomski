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

const uploadExcel = multer({ storage, fileFilter });

module.exports = {
  uploadExcel
};