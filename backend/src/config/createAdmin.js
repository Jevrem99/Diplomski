const path = require('path');
// Ovako skripta uvek zna gde je .env, bez obzira odakle je pokrećeš
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); 

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Čistim bazu od starih, ručno unetih korisnika...");
    // Ovo rešava P2002 grešku jer briše onog tvog hardkodovanog korisnika
    await prisma.user.deleteMany(); 

    console.log("Pravim pravog Super-Admina...");
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.create({
        data: {
            username: 'admin',
            email: 'admin@pmf.kg.ac.rs',
            password: hashedPassword,
            uloga: 'admin'
        }
    });
    console.log("✅ Super-Admin je uspešno kreiran u bazi!");
}

main().catch(console.error).finally(() => prisma.$disconnect());