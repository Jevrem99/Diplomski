const { logAction } = require('../services/auditService');
const terminiModel = require('../models/terminiKolokvijumaModel');
const ExcelJS = require('exceljs');

// 1. Dohvati predmete asistenta
const getMojiTermini = async (req, res) => {
  try {
    const userEmail = req.user.email; // Pretpostavka da authMiddleware dodaje req.user
    const predmeti = await terminiModel.getPredmetiZaAsistenta(userEmail);
    res.json(predmeti);
  } catch (error) {
    console.error('Greška u getMojiTermini:', error);
    res.status(500).json({ message: 'Greška pri dohvatanju predmeta' });
  }
};

// Svi predmeti sa terminima (admin pregled)
const getSviTermini = async (req, res) => {
  try {
    res.json(await terminiModel.getAllTerminiKolokvijuma());
  } catch (error) {
    console.error('Greška u getSviTermini:', error);
    res.status(500).json({ message: 'Greška pri dohvatanju predmeta' });
  }
};

const DATUM_REGEX = /^\d{2}\.\d{2}\.\d{4}\.?$/; // 29.04.2026 ili 29.04.2026.

// 2. Sačuvaj/Ažuriraj termine za predmet
const saveTermini = async (req, res) => {
  try {
    const { predmet_id, ...data } = req.body;
    if (!predmet_id || !Number.isInteger(Number(predmet_id))) {
      return res.status(400).json({ message: 'predmet_id je obavezan' });
    }

    // Menjati se mogu samo termini sopstvenih predmeta (admin sme sve)
    if (req.user.uloga !== 'admin' && !(await terminiModel.korisnikImaPredmet(req.user.email, predmet_id))) {
      return res.status(403).json({ message: 'Ovaj predmet nije vaš.' });
    }

    for (const k of ['k1', 'k2', 'k3']) {
      const datum = data[`${k}_datum`];
      if (datum && !DATUM_REGEX.test(String(datum).trim())) {
        return res.status(400).json({ message: `Datum ${k.toUpperCase()} mora biti u formatu DD.MM.GGGG.` });
      }
    }
    for (const polje of ['k1_trajanje', 'k2_trajanje', 'k3_trajanje', 'popravni_trajanje']) {
      const v = data[polje];
      if (v !== null && v !== undefined && v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 15 || Number(v) > 480)) {
        return res.status(400).json({ message: 'Trajanje kolokvijuma mora biti između 15 i 480 minuta.' });
      }
    }

    for (const polje of ['k1_dezurni', 'k2_dezurni', 'k3_dezurni', 'popravni_dezurni']) {
      const v = data[polje];
      if (v !== null && v !== undefined && v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 20)) {
        return res.status(400).json({ message: 'Potreban broj dežurnih mora biti ceo broj od 0 do 20.' });
      }
    }

    const updated = await terminiModel.upsertTerminiKolokvijuma(predmet_id, data);
    await logAction(req.user?.username || 'Korisnik', 'UPDATE', 'Termini kolokvijuma', `Predmet ID ${predmet_id}`);
    res.json({ message: 'Uspešno sačuvano', data: updated });
  } catch (error) {
    console.error('Greška u saveTermini:', error);
    res.status(500).json({ message: 'Greška pri čuvanju termina' });
  }
};

// 3. Export u Excel fajl

const exportExcel = async (req, res) => {
  try {
    const predmeti = await terminiModel.getAllTerminiKolokvijuma();

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Aplikacija za raspored ispita';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Termini kolokvijuma');

    // =====================================================
    // NAZIVI KOLONA
    // =====================================================

    worksheet.mergeCells('A1:A2');
    worksheet.getCell('A1').value = 'Godina';

    worksheet.mergeCells('B1:B2');
    worksheet.getCell('B1').value = 'Naziv predmeta';

    worksheet.mergeCells('C1:C2');
    worksheet.getCell('C1').value = 'Broj studenata';

    // Prvi kolokvijum
    worksheet.mergeCells('D1:F1');
    worksheet.getCell('D1').value = 'Prvi kolokvijum';
    worksheet.getCell('D2').value = 'Najraniji datum';
    worksheet.getCell('E2').value = 'Trajanje (min)';
    worksheet.getCell('F2').value = 'Računarska sala';

    // Drugi kolokvijum
    worksheet.mergeCells('G1:I1');
    worksheet.getCell('G1').value = 'Drugi kolokvijum';
    worksheet.getCell('G2').value = 'Najraniji datum';
    worksheet.getCell('H2').value = 'Trajanje (min)';
    worksheet.getCell('I2').value = 'Računarska sala';

    // Treći kolokvijum
    worksheet.mergeCells('J1:L1');
    worksheet.getCell('J1').value = 'Treći kolokvijum';
    worksheet.getCell('J2').value = 'Najraniji datum';
    worksheet.getCell('K2').value = 'Trajanje (min)';
    worksheet.getCell('L2').value = 'Računarska sala';

    // Popravni kolokvijum
    worksheet.mergeCells('M1:P1');
    worksheet.getCell('M1').value = 'Popravni kolokvijum (opciono)';

    worksheet.getCell('M2').value = 'U terminu ispita';
    worksheet.getCell('N2').value = 'Najraniji datum';
    worksheet.getCell('O2').value = 'Trajanje (min)';
    worksheet.getCell('P2').value = 'Računarska sala';

    // Napomena
    worksheet.mergeCells('Q1:Q2');
    worksheet.getCell('Q1').value = 'Napomena';

    // =====================================================
    // ŠIRINE KOLONA
    // =====================================================

    const sirineKolona = [
      15, // A - Godina
      36, // B - Naziv predmeta
      16, // C - Broj studenata
      17, // D - K1 datum
      14, // E - K1 trajanje
      17, // F - K1 sala
      17, // G - K2 datum
      14, // H - K2 trajanje
      17, // I - K2 sala
      17, // J - K3 datum
      14, // K - K3 trajanje
      17, // L - K3 sala
      19, // M - U terminu ispita
      17, // N - Datum popravnog
      14, // O - Trajanje popravnog
      17, // P - Sala za popravni
      40  // Q - Napomena
    ];

    sirineKolona.forEach((sirina, indeks) => {
      worksheet.getColumn(indeks + 1).width = sirina;
    });

    // =====================================================
    // STIL ZAGLAVLJA
    // =====================================================

    [1, 2].forEach((brojReda) => {
      const red = worksheet.getRow(brojReda);

      red.height = brojReda === 1 ? 30 : 38;

      for (let kolona = 1; kolona <= 17; kolona++) {
        const celija = red.getCell(kolona);

        celija.font = {
          name: 'Arial',
          bold: true,
          color: { argb: 'FFFFFFFF' },
          size: 10
        };

        celija.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1F63A0' }
        };

        celija.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };

        celija.border = {
          top: {
            style: 'thin',
            color: { argb: 'FFB8C7D9' }
          },
          bottom: {
            style: 'thin',
            color: { argb: 'FFB8C7D9' }
          },
          left: {
            style: 'thin',
            color: { argb: 'FFB8C7D9' }
          },
          right: {
            style: 'thin',
            color: { argb: 'FFB8C7D9' }
          }
        };
      }
    });

    // =====================================================
    // POMOĆNE FUNKCIJE ZA STILOVE
    // =====================================================

    const stilGodisnjegNaslova = (brojReda) => {
      const red = worksheet.getRow(brojReda);

      red.height = 28;

      for (let kolona = 1; kolona <= 17; kolona++) {
        const celija = red.getCell(kolona);

        celija.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF163A5F' }
        };

        celija.font = {
          name: 'Arial',
          bold: true,
          size: 12,
          color: { argb: 'FFFFFFFF' }
        };

        celija.alignment = {
          horizontal: 'left',
          vertical: 'middle',
          indent: 1
        };

        celija.border = {
          top: {
            style: 'medium',
            color: { argb: 'FF1F63A0' }
          },
          bottom: {
            style: 'medium',
            color: { argb: 'FF1F63A0' }
          }
        };
      }
    };

    const istakniCeliju = (celija, pozadina, bojaTeksta) => {
      celija.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: pozadina }
      };

      celija.font = {
        name: 'Arial',
        bold: true,
        size: 10,
        color: { argb: bojaTeksta }
      };

      celija.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };

      celija.border = {
        top: {
          style: 'thin',
          color: { argb: 'FFD1D5DB' }
        },
        bottom: {
          style: 'thin',
          color: { argb: 'FFD1D5DB' }
        },
        left: {
          style: 'thin',
          color: { argb: 'FFD1D5DB' }
        },
        right: {
          style: 'thin',
          color: { argb: 'FFD1D5DB' }
        }
      };
    };

    const nazivGodine = (godina) => {
      const nazivi = {
        1: 'PRVA GODINA',
        2: 'DRUGA GODINA',
        3: 'TREĆA GODINA',
        4: 'ČETVRTA GODINA'
      };

      return nazivi[godina] || `${godina}. GODINA`;
    };

    // =====================================================
    // SORTIRANJE PREDMETA
    // =====================================================

    const sortiraniPredmeti = [...predmeti].sort((a, b) => {
      const razlikaGodine = Number(a.godina) - Number(b.godina);

      if (razlikaGodine !== 0) {
        return razlikaGodine;
      }

      const razlikaSemestra = String(a.semestar || '')
        .localeCompare(String(b.semestar || ''), 'sr');

      if (razlikaSemestra !== 0) {
        return razlikaSemestra;
      }

      return String(a.naziv || '')
        .localeCompare(String(b.naziv || ''), 'sr');
    });

    // =====================================================
    // GRUPISANJE PREDMETA PO GODINAMA
    // =====================================================

    let aktivnaGodina = null;
    let brojPodatkovnogReda = 0;

    for (const p of sortiraniPredmeti) {
      // Kada se promeni godina, dodajemo naslov preko A-Q.
      if (aktivnaGodina !== p.godina) {
        aktivnaGodina = p.godina;

        const redNaslova = worksheet.addRow([
          nazivGodine(p.godina)
        ]);

        worksheet.mergeCells(
          `A${redNaslova.number}:Q${redNaslova.number}`
        );

        redNaslova.getCell(1).value = nazivGodine(p.godina);

        stilGodisnjegNaslova(redNaslova.number);
      }

      const t = p.terminiKolokvijuma || {};

      const popravniUTerminuIspita =
        Boolean(t.popravni_u_terminu_ispita);

      // Prvi stubac je prazan jer se godina prikazuje
      // u zajedničkom naslovu iznad grupe predmeta.
      const red = worksheet.addRow([
        '',
        p.naziv,
        p.broj_studenata ?? 0,

        // Prvi kolokvijum
        t.k1_datum || '',
        t.k1_trajanje ?? '',
        t.k1_racunarska_sala ? 'Da' : 'Ne',

        // Drugi kolokvijum
        t.k2_datum || '',
        t.k2_trajanje ?? '',
        t.k2_racunarska_sala ? 'Da' : 'Ne',

        // Treći kolokvijum
        t.k3_datum || '',
        t.k3_trajanje ?? '',
        t.k3_racunarska_sala ? 'Da' : 'Ne',

        // Popravni kolokvijum
        popravniUTerminuIspita ? 'Da' : 'Ne',
        popravniUTerminuIspita
          ? ''
          : (t.popravni_datum || ''),
        t.popravni_trajanje ?? '',
        t.popravni_racunarska_sala ? 'Da' : 'Ne',

        // Napomena
        t.napomena || ''
      ]);

      brojPodatkovnogReda++;

      red.height = 32;

      // Osnovni izgled podatkovnog reda
      for (let kolona = 1; kolona <= 17; kolona++) {
        const celija = red.getCell(kolona);

        celija.font = {
          name: 'Arial',
          size: 10,
          color: { argb: 'FF334155' }
        };

        celija.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        };

        celija.border = {
          top: {
            style: 'thin',
            color: { argb: 'FFE2E8F0' }
          },
          bottom: {
            style: 'thin',
            color: { argb: 'FFE2E8F0' }
          },
          left: {
            style: 'thin',
            color: { argb: 'FFE2E8F0' }
          },
          right: {
            style: 'thin',
            color: { argb: 'FFE2E8F0' }
          }
        };

        if (brojPodatkovnogReda % 2 === 0) {
          celija.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' }
          };
        }
      }

      // Broj studenata
      red.getCell(3).alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };

      // Isticanje vrednosti "Da" za računarske sale.
      // F = 6, I = 9, L = 12, P = 16.
      const koloneRacunarskeSale = [6, 9, 12, 16];

      for (const brojKolone of koloneRacunarskeSale) {
        const celija = red.getCell(brojKolone);

        if (
          String(celija.value || '').trim().toLowerCase() === 'da'
        ) {
          istakniCeliju(
            celija,
            'FFFFE08A',
            'FF713F12'
          );
        } else {
          celija.alignment = {
            horizontal: 'center',
            vertical: 'middle'
          };
        }
      }

      // Isticanje "Da" kada je popravni u terminu ispita.
      // Kolona M = 13.
      const celijaTerminIspita = red.getCell(13);

      if (
        String(celijaTerminIspita.value || '')
          .trim()
          .toLowerCase() === 'da'
      ) {
        istakniCeliju(
          celijaTerminIspita,
          'FFBFDBFE',
          'FF1D4ED8'
        );
      } else {
        celijaTerminIspita.alignment = {
          horizontal: 'center',
          vertical: 'middle'
        };
      }

      // Centriranje trajanja.
      [5, 8, 11, 15].forEach((brojKolone) => {
        red.getCell(brojKolone).alignment = {
          horizontal: 'center',
          vertical: 'middle'
        };
      });
    }

    // =====================================================
    // PODEŠAVANJA PRIKAZA I ŠTAMPE
    // =====================================================

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 2
      }
    ];

    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };

    // =====================================================
    // SLANJE EXCEL FAJLA
    // =====================================================

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Izbor_termina_kolokvijuma.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Greška pri izvozu u Excel:', error);

    if (!res.headersSent) {
      res.status(500).json({
        message: 'Greška pri generisanju Excel fajla'
      });
    } else {
      res.end();
    }
  }
};


module.exports = {
  getMojiTermini,
  getSviTermini,
  saveTermini,
  exportExcel
};