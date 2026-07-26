import multer from 'multer';

// Čuvamo fajl u RAM memoriji (bez pisanja na disk)
const storage = multer.memoryStorage();

// Opciono: filtriramo da dozvolimo samo Excel ekstenzije
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

export const uploadExcel = multer({ storage, fileFilter });