const XLSX = require('xlsx');
const prisma = require('../db/prisma'); // Koristimo Prismu za čist i bezbedan upis

// Reči koje sistem treba da ignoriše u ćelijama (zaglavlja)
const IGNORISI_TEKST = ['шифра', 'предмет', 'наставник', 'сарадник', 'статус предмета', 'редни број', 'врста вежби', 'модули'];

function jeZaglavljeIliPrazno(tekst) {
    if (!tekst || String(tekst).trim() === '') return true;
    const t = String(tekst).trim().toLowerCase();
    return IGNORISI_TEKST.includes(t);
}

// Funkcija za pametno pronalaženje godine
function parseGodina(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    if (t.includes('iv ') || t.includes('iv година') || t.includes('4. година') || t.includes('четврта')) return 4;
    if (t.includes('iii ') || t.includes('iii година') || t.includes('3. година') || t.includes('трећа')) return 3;
    if (t.includes('ii ') || t.includes('ii година') || t.includes('2. година') || t.includes('друга')) return 2;
    if (t.includes('i ') || t.includes('i година') || t.includes('1. година') || t.includes('прва')) return 1;
    return null;
}

// Pronalazi ili kreira profesora u bazi
async function findOrCreateProfesor(imePrezime, isSaradnik) {
    if (jeZaglavljeIliPrazno(imePrezime)) return null;

    const cisto = String(imePrezime).replace(/\s+/g, ' ').trim();
    const delovi = cisto.split(' ');
    const ime = delovi[0];
    const prezime = delovi.slice(1).join(' ') || 'Nepoznato';

    let prof = await prisma.profesor.findFirst({
        where: { ime: ime, prezime: prezime }
    });

    if (prof) {
        // Ako asistent postane redovni profesor, ažuriramo mu status
        if (prof.is_saradnik && !isSaradnik) {
            prof = await prisma.profesor.update({
                where: { id: prof.id },
                data: { is_saradnik: false }
            });
        }
        return prof.id;
    }

    // Kreiramo novog
    const noviProf = await prisma.profesor.create({
        data: {
            ime: ime,
            prezime: prezime,
            is_saradnik: isSaradnik,
            email: ''
        }
    });

    return noviProf.id;
}

const importPredmetiExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Molimo vas pošaljite Excel fajl.' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Čitamo prvi sheet
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let currentGodina = 1;
        let currentSemestar = 'Zimski';
        let currentSifra = null;

        // Map struktura skuplja sve podatke o predmetu pre nego što ga upiše u bazu
        const predmetiMap = new Map();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const rowText = row.map(cell => String(cell || '').trim()).join(' ').toLowerCase();

            // 1. Ažuriranje sekcije (Godina i Semestar)
            if (rowText.includes('година') || rowText.includes('godina')) {
                const detektovanaGodina = parseGodina(rowText);
                if (detektovanaGodina) currentGodina = detektovanaGodina;
            }

            if (rowText.includes('зимски') || rowText.includes('zimski')) {
                currentSemestar = 'Zimski';
                continue;
            }
            if (rowText.includes('летњи') || rowText.includes('letnji')) {
                currentSemestar = 'Letnji';
                continue;
            }

            // 2. Parsiranje kolona
            const sifra = row[1];
            const naziv = row[2];
            const status = row[3]; 
            const nastavnik = row[7]; // Kolona H u vašem fajlu
            const saradnik = row[9];  // Kolona J u vašem fajlu

            // Ako imamo šifru i naziv u istom redu - TO JE NOVI PREDMET
            if (!jeZaglavljeIliPrazno(sifra) && !jeZaglavljeIliPrazno(naziv)) {
                currentSifra = String(sifra).replace(/\t/g, '').trim();
                const cistNaziv = String(naziv).replace(/\t/g, '').trim();
                const cistStatus = status && !jeZaglavljeIliPrazno(status) ? String(status).trim() : 'О';

                if (!predmetiMap.has(currentSifra)) {
                    predmetiMap.set(currentSifra, {
                        sifra: currentSifra,
                        naziv: cistNaziv,
                        godina: currentGodina,
                        semestar: currentSemestar,
                        status: cistStatus,
                        nastavnikIme: nastavnik,
                        saradniciImena: new Set()
                    });
                }

                if (!jeZaglavljeIliPrazno(saradnik)) {
                    predmetiMap.get(currentSifra).saradniciImena.add(saradnik);
                }

            } 
            // Ako je šifra prazna, a imali smo prethodni predmet - TO JE DODATNI ASISTENT
            else if (jeZaglavljeIliPrazno(sifra) && currentSifra) {
                if (!jeZaglavljeIliPrazno(saradnik)) {
                    predmetiMap.get(currentSifra).saradniciImena.add(saradnik);
                }
            }
        }

        // 3. UPIS U BAZU PODATAKA
        for (const [sifra, p] of predmetiMap.entries()) {
            
            // Rešavanje glavnog profesora
            let profesorId = null;
            if (p.nastavnikIme && !jeZaglavljeIliPrazno(p.nastavnikIme)) {
                profesorId = await findOrCreateProfesor(p.nastavnikIme, false);
            }

            // Rešavanje višestrukih asistenata
            const saradniciIds = [];
            for (const saradnikIme of p.saradniciImena) {
                const sId = await findOrCreateProfesor(saradnikIme, true);
                if (sId) saradniciIds.push({ id: sId });
            }

            // Upsert (Dodaj ako ne postoji, ažuriraj ako postoji)
            await prisma.predmet.upsert({
                where: { sifra: p.sifra },
                update: {
                    naziv: p.naziv,
                    godina: p.godina,
                    semestar: p.semestar,
                    status: p.status,
                    profesor_id: profesorId,
                    saradnici: {
                        set: [], // Briše stare veze pre upisa novih
                        connect: saradniciIds 
                    }
                },
                create: {
                    sifra: p.sifra,
                    naziv: p.naziv,
                    godina: p.godina,
                    semestar: p.semestar,
                    status: p.status,
                    profesor_id: profesorId,
                    saradnici: {
                        connect: saradniciIds
                    }
                }
            });
        }

        return res.status(200).json({ message: 'Uspešno uvezeni predmeti, profesori i saradnici iz Excela!' });

    } catch (error) {
        console.error('Greška pri obradi Excel fajla:', error);
        return res.status(500).json({ message: 'Greška pri obradi Excel fajla.', error: error.message });
    }
};

module.exports = {
    importPredmetiExcel
};