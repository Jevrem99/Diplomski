require('dotenv').config();
const types = require('pg').types;
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

types.setTypeParser(1083, val => val);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({ adapter });

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