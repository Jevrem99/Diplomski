const ExcelJS = require('exceljs');
const prisma = require('../db/prisma');
const dezurstvaModel = require('../models/dezurstvaModel');

const getMojaDezurstva = async (req, res) => {
    const { saradnik_id } = req.params;
    try {
        const dezurstva = await dezurstvaModel.getDezurstvaBySaradnikId(saradnik_id);
        res.status(200).json(dezurstva);
    } catch (error) {
        console.error('Greška pri dohvatanju dežurstava:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ---- Šablon "Raspored dežurstava" (stilovi preuzeti iz fakultetskog Excel fajla) ----
const FIXED_HEADERS = [
    'Predmet - kolokvijum',
    'Datum',
    'Broj sati',
    'Potreban broj dežurnih',
    'Broj dežurnih',
    'Broj prijavljenih studenata',
];
const FIRST_ASSISTANT_COL = FIXED_HEADERS.length + 1; // G
const DEFAULT_HOURS = 2;

const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

const THIN_BLACK = { style: 'thin', color: { argb: 'FF000000' } };
const MEDIUM_GRAY = { style: 'medium', color: { argb: 'FFCCCCCC' } };
const BORDER_THIN = { left: THIN_BLACK, right: THIN_BLACK, top: THIN_BLACK, bottom: THIN_BLACK };
const BORDER_MEDIUM = { left: MEDIUM_GRAY, right: MEDIUM_GRAY, top: MEDIUM_GRAY, bottom: MEDIUM_GRAY };
// Kolona C u šablonu nema levu ivicu (deli je sa kolonom B)
const BORDER_MEDIUM_NO_LEFT = { right: MEDIUM_GRAY, top: MEDIUM_GRAY, bottom: MEDIUM_GRAY };

const font = (size, extra = {}) => ({ name: 'Calibri', family: 2, size, ...extra });

// @db.Time kolone stižu kao Date na 1970-01-01 (UTC), pa razliku računamo direktno u ms.
const izracunajSate = (vreme, vremeKraja) => {
    if (!vreme || !vremeKraja) return DEFAULT_HOURS;
    const sati = (new Date(vremeKraja) - new Date(vreme)) / 3600000;
    return sati > 0 ? Math.round(sati * 100) / 100 : DEFAULT_HOURS;
};

// Isti tekst kao u PDF/kalendar izvozu: "<predmet>\n - I колоквијум"
const tipTekst = (ispit) => {
    const tip = String(ispit.tip_kolokvijuma || 'I').trim();
    const lower = tip.toLowerCase();
    if (ispit.is_ispit) return 'испит';
    if (lower === 'тест' || lower === 'test') return 'тест';
    if (lower.includes('тест') || lower.includes('test')) return 'поправни тест';
    if (lower.includes('поправни') || lower.includes('popravni')) return 'поправни колоквијум';
    return `${tip} колоквијум`;
};

// Potreban broj dežurnih koji je saradnik uneo na stranici "Termini kolokvijuma" (null ako nije unet)
const potrebnoDezurnih = (ispit) => {
    const t = ispit.predmet?.terminiKolokvijuma;
    if (!t || ispit.is_ispit) return null;
    const tip = String(ispit.tip_kolokvijuma || 'I').trim().toLowerCase();
    let v = null;
    if (tip.includes('поправни') || tip.includes('popravni')) v = t.popravni_dezurni;
    else if (tip === 'iii') v = t.k3_dezurni;
    else if (tip === 'ii') v = t.k2_dezurni;
    else if (tip === 'i') v = t.k1_dezurni;
    return Number.isInteger(v) ? v : null;
};

const exportRasporedDezurstava = async (req, res) => {
    try {
        // Opcioni filter: ?ids=1,2,3 (npr. ispiti trenutno prikazani na frontu)
        const where = { is_ispit: false };
        if (typeof req.query?.ids === 'string' && req.query.ids.trim() !== '') {
            const ids = req.query.ids.split(',').map(Number).filter(Number.isInteger);
            where.id = { in: ids };
        }

        const ispiti = await prisma.ispit.findMany({
            where,
            include: {
                predmet: { include: { terminiKolokvijuma: true } },
                dezurstva: { include: { saradnik: true } },
            },
            orderBy: [{ datum: 'asc' }, { vreme: 'asc' }],
        });

        // Raspored dežurstava je samo za saradnike (asistente): profesori se ne prikazuju ni ne računaju
        ispiti.forEach((ispit) => { ispit.dezurstva = ispit.dezurstva.filter((d) => d.saradnik && d.saradnik.is_saradnik); });

        // Jedinstveni asistenti, sortirani po prezimenu pa imenu
        const asistentiMap = new Map();
        ispiti.forEach((ispit) => {
            ispit.dezurstva.forEach((d) => {
                if (d.saradnik && !asistentiMap.has(d.saradnik.id)) {
                    asistentiMap.set(d.saradnik.id, d.saradnik);
                }
            });
        });
        const asistenti = [...asistentiMap.values()].sort(
            (a, b) =>
                a.prezime.localeCompare(b.prezime, 'sr') || a.ime.localeCompare(b.ime, 'sr')
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        const lastAssistantCol = FIRST_ASSISTANT_COL + asistenti.length - 1;
        const statusCol = FIRST_ASSISTANT_COL + asistenti.length;
        const colLetter = (n) => worksheet.getColumn(n).letter;
        const firstLetter = colLetter(FIRST_ASSISTANT_COL);
        const lastLetter = colLetter(Math.max(lastAssistantCol, FIRST_ASSISTANT_COL));

        const firstDataRow = 3;
        const lastDataRow = firstDataRow + ispiti.length - 1;

        // ---- Red 1: zaglavlja (Status kolona nema zaglavlje) ----
        const headerRow = worksheet.addRow([
            ...FIXED_HEADERS,
            ...asistenti.map((a) => `${(a.ime || '').charAt(0)}. ${a.prezime}`),
        ]);
        headerRow.height = 66.75;

        // ---- Red 2: ukupno sati po asistentu ----
        const summaryData = new Array(FIXED_HEADERS.length).fill(null);
        asistenti.forEach((_, i) => {
            const col = colLetter(FIRST_ASSISTANT_COL + i);
            summaryData.push(
                ispiti.length > 0
                    ? { formula: `SUMPRODUCT($C$${firstDataRow}:$C$${lastDataRow},${col}${firstDataRow}:${col}${lastDataRow})` }
                    : 0
            );
        });
        const summaryRow = worksheet.addRow(summaryData);
        summaryRow.height = 15.75;

        // Stilovi zaglavlja (red 1) i sumarnog reda (red 2)
        const headerFontSizes = [8, 9, 8, 8, 8, 10];
        for (let c = 1; c <= lastAssistantCol; c++) {
            const isFixed = c < FIRST_ASSISTANT_COL;
            const border = c <= 2 ? BORDER_THIN : c === 3 ? BORDER_MEDIUM_NO_LEFT : BORDER_MEDIUM;
            const h = headerRow.getCell(c);
            h.font = font(isFixed ? headerFontSizes[c - 1] : 10);
            h.fill = GRAY_FILL;
            h.border = border;
            h.alignment = isFixed
                ? { horizontal: 'center', vertical: 'middle', wrapText: true }
                : { horizontal: 'center', vertical: 'middle', wrapText: true, textRotation: 90 };

            const s = summaryRow.getCell(c);
            s.font = isFixed ? font(headerFontSizes[c - 1]) : font(10, { bold: true });
            s.fill = GRAY_FILL;
            s.border = border;
            s.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
        // A, B, D, E, F su spojene preko dva reda (kao u šablonu); C ostaje zasebno
        ['A', 'B', 'D', 'E', 'F'].forEach((l) => worksheet.mergeCells(`${l}1:${l}2`));

        // Gradijent boja (zeleno -> belo -> crveno) preko sumarnog reda
        if (asistenti.length > 0) {
            worksheet.addConditionalFormatting({
                ref: `${firstLetter}2:${lastLetter}2`,
                rules: [
                    {
                        type: 'colorScale',
                        priority: 1,
                        cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
                        color: [{ argb: 'FF63BE7B' }, { argb: 'FFFCFCFF' }, { argb: 'FFF8696B' }],
                    },
                ],
            });
        }

        // ---- Red 3+: podaci ----
        // Termini iste grupe traju istovremeno: sate nosi samo prvi red grupe, da se zbir po asistentu ne udvostruči
        const vidjeneGrupe = new Set();
        ispiti.forEach((ispit, idx) => {
            const ponovljenaGrupa = Boolean(ispit.grupa_kljuc) && vidjeneGrupe.has(ispit.grupa_kljuc);
            if (ispit.grupa_kljuc) vidjeneGrupe.add(ispit.grupa_kljuc);
            const rNum = firstDataRow + idx;
            const dodeljeni = new Set(ispit.dezurstva.map((d) => d.saradnik_id));
            const naziv = ispit.predmet?.naziv || '';

            const rowData = [
                `${naziv}\n - ${tipTekst(ispit)}`,
                new Date(ispit.datum),
                ponovljenaGrupa ? 0 : izracunajSate(ispit.vreme, ispit.vreme_kraja),
                potrebnoDezurnih(ispit) ?? ispit.dezurstva.length, // nije uneto -> koliko ih je dodeljeno
                asistenti.length > 0
                    ? { formula: `SUM(${firstLetter}${rNum}:${lastLetter}${rNum})` }
                    : 0,
                ispit.predmet?.broj_studenata || null,
            ];
            asistenti.forEach((a) => rowData.push(dodeljeni.has(a.id) ? 1 : null));
            rowData.push({
                formula: `IF(D${rNum}=E${rNum},"OK",IF(D${rNum}<E${rNum},"Visak",""))`,
            });

            const row = worksheet.addRow(rowData);
            row.height = 29.25;

            const a = row.getCell(1);
            a.font = font(8);
            a.fill = GRAY_FILL;
            a.border = BORDER_THIN;
            a.alignment = { vertical: 'middle', wrapText: true };

            const b = row.getCell(2);
            b.numFmt = 'd.m.yyyy.';
            b.font = font(9);
            b.fill = GRAY_FILL;
            b.border = BORDER_THIN;
            b.alignment = { horizontal: 'left', vertical: 'middle' };

            [3, 4].forEach((c) => {
                const cell = row.getCell(c);
                cell.font = font(10);
                cell.fill = YELLOW_FILL;
                cell.border = c === 3 ? BORDER_MEDIUM_NO_LEFT : BORDER_MEDIUM;
                cell.alignment = { horizontal: 'left', wrapText: true };
            });

            for (let c = 5; c <= lastAssistantCol; c++) {
                const cell = row.getCell(c);
                cell.font = font(10, c === 5 ? { bold: true } : {});
                cell.border = BORDER_MEDIUM;
                cell.alignment = { horizontal: 'center', wrapText: true };
            }

            row.getCell(statusCol).font = font(11);
        });

        // ---- Širine kolona (iz šablona) ----
        const widths = [31.29, 9.29, 5.86, 6.43, 6.57, 8.71];
        widths.forEach((w, i) => { worksheet.getColumn(i + 1).width = w; });
        for (let c = FIRST_ASSISTANT_COL; c <= lastAssistantCol; c++) {
            worksheet.getColumn(c).width = 6.57;
        }
        worksheet.getColumn(statusCol).width = 9.14;

        worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 2, zoomScale: 112, zoomScaleNormal: 112 }];

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename=Raspored_dezurstava.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Greška pri exportu rasporeda dežurstava:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Greška pri generisanju Excel fajla' });
        }
    }
};

// ---- Kalendar (.ics) sa dežurstvima prijavljenog saradnika ----
const icsTekst = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const pad = (n) => String(n).padStart(2, '0');
const danBroj = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]).replace(/-/g, '');
const satMin = (t) => (t instanceof Date ? t.toISOString().substring(11, 16) : String(t).substring(0, 5)).replace(':', '');

// Vreme je "plutajuće" (bez vremenske zone), pa se u kalendaru prikazuje baš kao u rasporedu
const icsVreme = (datum, vreme) => `${danBroj(datum)}T${satMin(vreme)}00`;
const icsKraj = (datum, vreme, vremeKraja) => {
    if (vremeKraja) return icsVreme(datum, vremeKraja);
    const dan = danBroj(datum);
    const hh = Number(satMin(vreme).substring(0, 2)) + 2;
    return `${dan}T${pad(Math.min(hh, 23))}${satMin(vreme).substring(2)}00`;
};

const exportMojKalendar = async (req, res) => {
    try {
        const ja = await prisma.profesor.findFirst({ where: { email: { equals: req.user.email || '', mode: 'insensitive' } } });
        if (!ja) return res.status(404).json({ error: 'Vaš nalog nije povezan sa profilom saradnika.' });

        const dezurstva = await dezurstvaModel.getDezurstvaBySaradnikId(ja.id);
        const sada = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const linije = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//PMF Kragujevac//Raspored dezurstava//SR',
            'CALSCALE:GREGORIAN',
            'X-WR-CALNAME:Moja dežurstva'
        ];
        dezurstva.filter((d) => d.ispit).forEach((d) => {
            const i = d.ispit;
            linije.push(
                'BEGIN:VEVENT',
                `UID:dezurstvo-${d.id}@raspored.pmf`,
                `DTSTAMP:${sada}`,
                `DTSTART:${icsVreme(i.datum, i.vreme)}`,
                `DTEND:${icsKraj(i.datum, i.vreme, i.vreme_kraja)}`,
                `SUMMARY:${icsTekst(`Dežurstvo: ${i.predmet?.naziv || 'ispit'}`)}`,
                ...(i.sala?.naziv ? [`LOCATION:${icsTekst(i.sala.naziv)}`] : []),
                `DESCRIPTION:${icsTekst(i.is_ispit ? 'Ispit' : `${i.tip_kolokvijuma || ''} kolokvijum`.trim())}`,
                'END:VEVENT'
            );
        });
        linije.push('END:VCALENDAR');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=moja-dezurstva.ics');
        res.send(linije.join('\r\n') + '\r\n');
    } catch (error) {
        console.error('Greška pri izvozu kalendara:', error);
        res.status(500).json({ error: 'Greška pri izvozu kalendara.' });
    }
};

module.exports = { getMojaDezurstva, exportRasporedDezurstava, exportMojKalendar, _internal: { potrebnoDezurnih } };
