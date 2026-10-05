const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const prisma = require('./prisma');

// Pravi administratora ako u bazi nema nijednog. Ne briše i ne menja postojeće korisnike.
//
// Podešavanje preko .env:
//   ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD
// Ako ADMIN_PASSWORD nije zadat:
//   - u razvoju (NODE_ENV != production) lozinka je "admin123" (promeni je posle prijave),
//   - u produkciji se generiše nasumična lozinka koja se ispiše jednom u konzoli.
async function ensureAdmin() {
    const postojeci = await prisma.user.findFirst({ where: { uloga: 'admin' } });
    if (postojeci) return { created: false };

    const { username, email } = config.admin;
    let password = config.admin.password;
    let generisana = false;
    if (!password) {
        generisana = config.isProduction;
        password = config.isProduction ? crypto.randomBytes(9).toString('base64url') : 'admin123';
    }

    const zauzet = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (zauzet) {
        console.warn(`[seed] Admin nije napravljen: korisnik "${zauzet.username}" već postoji, a nije admin. Promeni ADMIN_USERNAME/ADMIN_EMAIL u .env.`);
        return { created: false };
    }

    await prisma.user.create({
        data: {
            username,
            email,
            password: await bcrypt.hash(password, 10),
            uloga: 'admin'
        }
    });

    console.log(`[seed] Napravljen admin "${username}" (${email}).`);
    if (generisana) {
        console.log(`[seed] Generisana lozinka (prikazuje se samo sada): ${password}`);
    } else if (!config.admin.password) {
        console.warn('[seed] Koristi se podrazumevana lozinka "admin123" - promeni je ili postavi ADMIN_PASSWORD u .env.');
    }
    return { created: true };
}

module.exports = { ensureAdmin };

// npm run seed
if (require.main === module) {
    ensureAdmin()
        .catch((err) => { console.error('[seed] Greška:', err); process.exitCode = 1; })
        .finally(() => prisma.$disconnect());
}
