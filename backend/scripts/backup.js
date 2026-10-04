// npm run backup            -> pravi novu rezervnu kopiju u backend/backups
// npm run backup -- list    -> spisak kopija
// npm run backup -- restore <fajl> --yes   -> VRAĆA bazu na stanje iz kopije (briše trenutne podatke!)
require('../src/config/config');
const path = require('path');
const { napraviBackup, vratiBackup, izlistajBackupe, zatvori, BACKUP_DIR } = require('../src/services/backupService');

(async () => {
    const [, , komanda, arg, potvrda] = process.argv;
    try {
        if (komanda === 'list') {
            izlistajBackupe().forEach((f) => console.log(f));
        } else if (komanda === 'restore') {
            if (!arg || potvrda !== '--yes') {
                console.error('Upotreba: npm run backup -- restore <fajl> --yes   (briše trenutne podatke u bazi!)');
                process.exitCode = 1;
                return;
            }
            const fajl = path.isAbsolute(arg) ? arg : path.join(BACKUP_DIR, arg);
            const sigurnosna = await napraviBackup('pre-restore');
            console.log(`Sigurnosna kopija trenutnog stanja: ${sigurnosna}`);
            await vratiBackup(fajl);
            console.log('Baza je vraćena na stanje iz kopije.');
        } else {
            console.log('Napravljeno:', await napraviBackup('rucno'));
        }
    } catch (err) {
        console.error('Greška:', err.message);
        process.exitCode = 1;
    } finally {
        await zatvori();
    }
})();
