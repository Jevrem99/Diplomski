require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const basePrisma = new PrismaClient();

const prisma = basePrisma.$extends({
  result: {
    ispit: {
      datum: {
        needs: { datum: true },
        compute(ispit) {
          return ispit.datum ? ispit.datum.toISOString().split('T')[0] : null;
        }
      },
      vreme: {
        needs: { vreme: true },
        compute(ispit) {
          return ispit.vreme ? ispit.vreme.toISOString().substring(11, 19) : null;
        }
      }
    }
  }
});

module.exports = prisma;
