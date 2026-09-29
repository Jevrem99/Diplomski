const XLSX = require('xlsx');
const prisma = require('../db/prisma');

// Reči koje sistem treba da ignoriše u ćelijama (zaglavlja)
const IGNORISI_TEKST = ['шифра', 'предмет', 'наставник', 'сарадник', 'статус предмета', 'редни број', 'врста вежби', 'модули'];

function jeZaglavljeIliPrazno(tekst) {
    if (!tekst || String(tekst).trim() === '' || String(tekst).trim() === 'NaN') return true;
    const t = String(tekst).trim().toLowerCase();
    return IGNORISI_TEKST.includes(t);
}

// Funkcija za čišćenje naziva predmeta od sufiksa poput "+ OAS Matematika"
function ocistiNazivPredmeta(rawNaziv) {
    if (!rawNaziv) return '';

    let naziv = String(rawNaziv).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Ako ima novi red koji je prešao u tekst napomene (npr. "drži se u letnjem...")
    naziv = naziv.replace(/држи се у.*$/i, '').trim();
    naziv = naziv.replace(/\(реализује се.*$/i, '').trim();

    // 2. Sečemo sve što počinje sa '+'
    if (naziv.includes('+')) {
        naziv = naziv.split('+')[0].trim();
    }

    // 3. Sečemo sve što počinje sa '-' iza koga sledi smer (OAS Fizika, OAS Matematika...)
    if (naziv.includes('-')) {
        const delovi = naziv.split('-');
        const posleCrte = delovi.slice(1).join('-').toLowerCase();
        if (posleCrte.includes('оас') || posleCrte.includes('физик') || posleCrte.includes('математ')) {
            naziv = delovi[0].trim();
        }
    }

    return naziv;
}

// Funkcija za pametno pronalaženje godine SAMO iz hedera
function parseGodinaIzHedera(text) {
    if (!text) return null;
    const t = text.trim().toLowerCase();
    
    // Proveravamo striktno heder forme (npr. "I godina", "II godina", "III godina", "IV godina")
    if (/^(iv\s+година|4\.\s*година|четврта\s+година)/i.test(t)) return 4;
    if (/^(iii\s+година|3\.\s*година|трећа\s+година)/i.test(t)) return 3;
    if (/^(ii\s+година|2\.\s*година|друга\s+година)/i.test(t)) return 2;
    if (/^(i\s+година|1\.\s*година|прва\s+година)/i.test(t)) return 1;

    // Fallback ako heder ima dodatni tekst (npr. "III godina - OAS")
    if (t.includes('iv godina') || t.includes('iv година')) return 4;
    if (t.includes('iii godina') || t.includes('iii година')) return 3;
    if (t.includes('ii godina') || t.includes('ii година')) return 2;
    if (t.includes('i godina') || t.includes('i година')) return 1;

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
        if (prof.is_saradnik && !isSaradnik) {
            prof = await prisma.profesor.update({
                where: { id: prof.id },
                data: { is_saradnik: false }
            });
        }
        return prof.id;
    }

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
        const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Prvi sheet
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let currentGodina = 1;
        let currentSemestar = 'Zimski';
        let currentSifra = null;

        const predmetiMap = new Map();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const colA = String(row[0] || '').trim();
            const colB = String(row[1] || '').trim();
            const colC = String(row[2] || '').trim();

            // 1. AŽURIRANJE GODINE I SEMESTRA (Gledamo samo prve kolone hedera, NE čitav red!)
            // Time sprečavamo da predmet koji u svom imenu ima "IV godina" prebaci brojač!
            const mogucaGodina = parseGodinaIzHedera(colA) || parseGodinaIzHedera(colB);
            if (mogucaGodina) {
                currentGodina = mogucaGodina;
            }

            const headerCheck = (colA + ' ' + colB + ' ' + colC).toLowerCase();
            if (headerCheck.includes('зимски') || headerCheck.includes('zimski')) {
                currentSemestar = 'Zimski';
                continue;
            }
            if (headerCheck.includes('летњи') || headerCheck.includes('letnji')) {
                currentSemestar = 'Letnji';
                continue;
            }

            // 2. PARSIRANJE PREDMETA
            const sifra = row[1];
            const naziv = row[2];
            const status = row[3]; 
            const nastavnik = row[7]; // Kolona H
            const saradnik = row[9];  // Kolona J

            // Ako imamo šifru i naziv - TO JE NOVI PREDMET
            if (!jeZaglavljeIliPrazno(sifra) && !jeZaglavljeIliPrazno(naziv)) {
                currentSifra = String(sifra).replace(/[\t\r\n]+/g, '').trim();
                const cistNaziv = ocistiNazivPredmeta(naziv);
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
            // Ako je šifra prazna, a imamo aktuelan predmet - TO JE DODATNI ASISTENT
            else if (jeZaglavljeIliPrazno(sifra) && currentSifra) {
                if (!jeZaglavljeIliPrazno(saradnik)) {
                    predmetiMap.get(currentSifra).saradniciImena.add(saradnik);
                }
            }
        }

        // 3. UPIS U BAZU PODATAKA
        for (const [sifra, p] of predmetiMap.entries()) {
            let profesorId = null;
            if (p.nastavnikIme && !jeZaglavljeIliPrazno(p.nastavnikIme)) {
                profesorId = await findOrCreateProfesor(p.nastavnikIme, false);
            }

            const saradniciIds = [];
            for (const saradnikIme of p.saradniciImena) {
                const sId = await findOrCreateProfesor(saradnikIme, true);
                if (sId) saradniciIds.push({ id: sId });
            }

            await prisma.predmet.upsert({
                where: { sifra: p.sifra },
                update: {
                    naziv: p.naziv,
                    godina: p.godina,
                    semestar: p.semestar,
                    status: p.status,
                    profesor_id: profesorId,
                    saradnici: {
                        set: [],
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