// Zastareo fajl: aplikacija koristi Prisma (src/db/prisma.js), a ne direktan pg pool.
// Može slobodno da se obriše (git rm backend/src/db/connection.js).
module.exports = require('./prisma');
