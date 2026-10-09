const { logAction } = require('../services/auditService');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { napraviBackup } = require('../services/backupService');
const prisma = require('../db/prisma');

// Reči koje sistem treba da ignoriše u ćelijama (zaglavlja)
const IGNORISI_TEKST = ['шифра', 'предмет', 'наставник', 'сарадник', 'статус предмета', 'редни број', 'врста вежби', 'модули', 'ментор', 'вежбе', 'предавања', 'бр. ч.'];

function jeZaglavljeIliPrazno(tekst) {
    if (!tekst || String(tekst).trim() === '' || String(tekst).trim() === 'NaN') return true;
    const t = String(tekst).trim().toLowerCase();
    return IGNORISI_TEKST.includes(t);
}

// Funkcija za čišćenje naziva predmeta od sufiksa poput "+ OAS Matematika"
function ocistiNazivPredmeta(rawNaziv) {
    if (!rawNaziv) return '';

    // 1. Čistimo prelome redova, tabove i duple razmake
    let naziv = String(rawNaziv).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

    // 2. Sečemo napomene u zagradama poput (реализује се...) ili "држи се у..."
    naziv = naziv.replace(/држи се у.*$/i, '').trim();
    naziv = naziv.replace(/\(?\s*(реализује|изводи) се.*$/i, '').trim();
    naziv = naziv.replace(/\(?\s*(realizuje|izvodi|drži|drzi) se.*$/i, '').trim();
    naziv = naziv.replace(/\s+предмет са .*$/i, '').trim();

    // 3. Čim naiđe na '+', odmah sečemo sve iza
    if (naziv.includes('+')) {
        naziv = naziv.split('+')[0].trim();
    }

    // 4. Čim naiđe na crticu sa razmakom ispred (' - ', ' – ', ' — '), odmah sečemo sve iza
    // (Ovo čisti " - OAS Matematika", a čuva reči poput "čovek-računar")
    const deloviSaCrticom = naziv.split(/\s+[-–—]/);
    if (deloviSaCrticom.length > 1) {
        naziv = deloviSaCrticom[0].trim();
    }

    return naziv;
}

// Semestar u kome se predmet STVARNO drži. Napomena uz naziv ("реализује се у летњем семестру",
// "држи се у зимском ...", i latinicom) ima prednost nad sekcijom tabele u kojoj predmet stoji.
function semestarIzNapomene(nazivRaw, trenutniSemestar) {
    const tekst = String(nazivRaw ?? '').replace(/\s+/g, ' ').toLowerCase();
    const m = tekst.match(/(?:реализује|држи|изводи)\s+се\s+у\s+(летњ|зимск)/)
        || tekst.match(/(?:realizuje|drži|drzi|izvodi)\s+se\s+u\s+(letnj|zimsk)/);
    if (!m) return trenutniSemestar;
    return (m[1].startsWith('лет') || m[1].startsWith('let')) ? 'Letnji' : 'Zimski';
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

// Raspored kolona po tipu sheet-a (OAS ima kolonu "Шифра", MAS nema)
const LAYOUT_OAS = { sifra: 1, naziv: 2, status: [3, 4, 5], studenti: 6, nastavnik: 7, saradnik: 9 };
const LAYOUT_MAS = { sifra: null, naziv: 1, status: [2, 3], studenti: 4, nastavnik: 5, saradnik: 7 };

// Čita samo sheet-ove "OAS 2025-26" / "MAS 2025-26" i to najnoviju školsku godinu u fajlu
function izaberiSheetove(workbook) {
    const sheets = workbook.SheetNames
        .map((name) => {
            const m = name.trim().match(/^(OAS|MAS)\s+(\d{4})-(\d{2})$/i);
            return m ? { name, program: m[1].toUpperCase(), godina: Number(m[2]) } : null;
        })
        .filter(Boolean);
    if (sheets.length === 0) {
        // Stari format fajla: samo prvi sheet, OAS raspored
        return [{ name: workbook.SheetNames[0], program: 'OAS' }];
    }
    const najnovija = Math.max(...sheets.map((x) => x.godina));
    return sheets.filter((x) => x.godina === najnovija);
}

// "68 + 10 (укупно 87)" -> 87, "67\r\n(укупно 81)" -> 81, "4+5" -> 9, 67 -> 67, prazno -> null
function parseBrojStudenata(celija) {
    if (celija === null || celija === undefined || celija === '') return null;
    if (typeof celija === 'number') return Math.round(celija);
    const tekst = String(celija).replace(/\s+/g, ' ').trim();
    const ukupno = tekst.match(/(?:укупно|ukupno)\s*(\d+)/i);
    if (ukupno) return Number(ukupno[1]);
    const brojevi = tekst.match(/\d+/g);
    return brojevi ? brojevi.reduce((zbir, n) => zbir + Number(n), 0) : null;
}

function normalizujZaKljuc(naziv) {
    return naziv.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

const normalizujIme = (ime) => String(ime || '').replace(/\s+/g, ' ').trim();

// Redovi (1-based, kao u Excelu) čiji je naziv predmeta obojen sivom ("Предмет који се не држи" iz legende)
function nadjiNeodrzavaneRedove(exWorkbook, sheetName, program) {
    const ws = exWorkbook.getWorksheet(sheetName);
    const nazivKolona = (program === 'MAS' ? LAYOUT_MAS : LAYOUT_OAS).naziv + 1;
    const redovi = new Set();
    if (!ws) return redovi;
    ws.eachRow((row, rowNumber) => {
        const fill = row.getCell(nazivKolona).fill;
        const boja = fill && fill.type === 'pattern' ? fill.fgColor : null;
        // Siva iz legende: tema 0 (bela) potamnjena ~25%
        if (boja && boja.theme === 0 && boja.tint < -0.2 && boja.tint > -0.3) redovi.add(rowNumber);
    });
    return redovi;
}

// Parsira jedan sheet i dopunjava Map(kljuc -> predmet)
function parsirajSheet(rows, program, predmetiMap, neodrzavaniRedovi, rowOffset) {
    const L = program === 'MAS' ? LAYOUT_MAS : LAYOUT_OAS;

    let currentGodina = 1;
    let currentSemestar = 'Zimski';
    let currentKljuc = null;

    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        if (!row || row.length === 0) continue;

        // Godina i semestar stoje samo u koloni A (naziv predmeta u drugim kolonama može sadržati "IV година")
        const colA = String(row[0] ?? '').trim();
        const mogucaGodina = parseGodinaIzHedera(colA);
        if (mogucaGodina) currentGodina = mogucaGodina;
        const colALower = colA.toLowerCase();
        if (colALower.includes('зимски') || colALower.includes('zimski')) { currentSemestar = 'Zimski'; continue; }
        if (colALower.includes('летњи') || colALower.includes('letnji')) { currentSemestar = 'Letnji'; continue; }

        const sifraRaw = L.sifra === null ? null : row[L.sifra];
        const nazivRaw = row[L.naziv];
        const nastavnik = row[L.nastavnik];
        const saradnik = row[L.saradnik];
        const statusRaw = L.status.map((i) => row[i]).find((v) => v && !jeZaglavljeIliPrazno(v));
        const imaRedniBroj = typeof row[0] === 'number';

        // Novi predmet: ima naziv i (status, šifru ili redni broj); šifra može da fali kod viših godina i na MAS-u
        if (!jeZaglavljeIliPrazno(nazivRaw) && (statusRaw || !jeZaglavljeIliPrazno(sifraRaw) || imaRedniBroj)) {
            // Predmet obojen sivo se ne drži: preskačemo ga i njegove dodatne redove
            if (neodrzavaniRedovi.has(idx + rowOffset)) {
                currentKljuc = null;
                continue;
            }

            const cistNaziv = ocistiNazivPredmeta(nazivRaw);
            const sifra = !jeZaglavljeIliPrazno(sifraRaw) ? String(sifraRaw).replace(/[\t\r\n]+/g, '').trim() : null;

            // Napomena "(реализује се у летњем/зимском семестру)" ima prednost nad sekcijom u kojoj predmet stoji
            const semestar = semestarIzNapomene(nazivRaw, currentSemestar);
            const kljuc = sifra || `${program}-G${currentGodina}-${semestar[0]}-${normalizujZaKljuc(cistNaziv)}`;
            currentKljuc = kljuc;

            if (!predmetiMap.has(kljuc)) {
                predmetiMap.set(kljuc, {
                    sifra: kljuc,
                    imaPraviSifru: Boolean(sifra),
                    naziv: cistNaziv,
                    godina: currentGodina,
                    semestar,
                    status: statusRaw ? String(statusRaw).trim() : 'О',
                    brojStudenata: parseBrojStudenata(row[L.studenti]),
                    nastavnikIme: nastavnik,
                    saradniciImena: new Set()
                });
            }
            if (!jeZaglavljeIliPrazno(saradnik)) predmetiMap.get(kljuc).saradniciImena.add(saradnik);
        }
        // Naziv prazan -> dodatni saradnik trenutnog predmeta
        else if (jeZaglavljeIliPrazno(nazivRaw) && currentKljuc) {
            if (!jeZaglavljeIliPrazno(saradnik)) predmetiMap.get(currentKljuc).saradniciImena.add(saradnik);
        }
    }
}

const importPredmetiExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Molimo vas pošaljite Excel fajl.' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        // ExcelJS čita boje ćelija (SheetJS ih ne daje), potreban nam je za sive "ne drži se" predmete
        const exWorkbook = new ExcelJS.Workbook();
        await exWorkbook.xlsx.load(req.file.buffer);
        const predmetiMap = new Map();

        for (const sheetInfo of izaberiSheetove(workbook)) {
            const sheet = workbook.Sheets[sheetInfo.name];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const rowOffset = XLSX.utils.decode_range(sheet['!ref']).s.r + 1; // indeks reda -> broj reda u Excelu
            const neodrzavani = nadjiNeodrzavaneRedove(exWorkbook, sheetInfo.name, sheetInfo.program);
            parsirajSheet(rows, sheetInfo.program, predmetiMap, neodrzavani, rowOffset);
        }

        // Ko je ikada upisan kao nastavnik je profesor, a profesori nisu saradnici (ne dežuraju)
        const imenaNastavnika = new Set();
        for (const p of predmetiMap.values()) {
            if (!jeZaglavljeIliPrazno(p.nastavnikIme)) imenaNastavnika.add(normalizujIme(p.nastavnikIme));
        }

        // Rezervna kopija pre upisa (uvoz menja predmete, profesore i veze sa saradnicima)
        await napraviBackup('pre-import').catch((e) => console.error('Rezervna kopija pre uvoza nije napravljena:', e.message));

        // UPIS U BAZU PODATAKA
        for (const p of predmetiMap.values()) {
            let profesorId = null;
            if (p.nastavnikIme && !jeZaglavljeIliPrazno(p.nastavnikIme)) {
                profesorId = await findOrCreateProfesor(p.nastavnikIme, false);
            }

            const saradniciIds = [];
            for (const saradnikIme of p.saradniciImena) {
                if (imenaNastavnika.has(normalizujIme(saradnikIme))) continue;
                const sId = await findOrCreateProfesor(saradnikIme, true);
                if (sId) saradniciIds.push({ id: sId });
            }

            const podaci = {
                naziv: p.naziv,
                godina: p.godina,
                semestar: p.semestar,
                status: p.status,
                profesor_id: profesorId,
                // Broj studenata prepisujemo samo ako je u Excelu pročitan (ne gazimo ručni unos nulom)
                ...(p.brojStudenata !== null ? { broj_studenata: p.brojStudenata } : {})
            };

            // Predmeti bez šifre: pre kreiranja traži postojeći po nazivu/godini/semestru da ne pravi duplikat
            let where = { sifra: p.sifra };
            if (!p.imaPraviSifru) {
                const postojeci = await prisma.predmet.findFirst({
                    where: { naziv: p.naziv, godina: p.godina, semestar: p.semestar }
                });
                if (postojeci) where = { id: postojeci.id };
            }

            await prisma.predmet.upsert({
                where,
                update: { ...podaci, saradnici: { set: [], connect: saradniciIds } },
                create: { sifra: p.sifra, ...podaci, saradnici: { connect: saradniciIds } }
            });
        }

        await logAction(req.user?.username || 'Korisnik', 'IMPORT', 'Predmeti', `Uvoz Excela: ${predmetiMap.size} predmeta`);
        return res.status(200).json({
            message: `Uspešno uvezeno ${predmetiMap.size} predmeta (sa brojem studenata), profesora i saradnika iz Excela!`
        });

    } catch (error) {
        console.error('Greška pri obradi Excel fajla:', error);
        return res.status(500).json({ message: 'Greška pri obradi Excel fajla.', error: error.message });
    }
};

module.exports = {
    importPredmetiExcel,
    // izloženo radi testiranja
    _internal: { parseBrojStudenata, ocistiNazivPredmeta, parseGodinaIzHedera, semestarIzNapomene }
};