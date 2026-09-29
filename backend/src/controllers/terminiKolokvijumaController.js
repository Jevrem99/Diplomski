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

// 2. Sačuvaj/Ažuriraj termine za predmet
const saveTermini = async (req, res) => {
  try {
    const { predmet_id, ...data } = req.body;
    if (!predmet_id) {
      return res.status(400).json({ message: 'predmet_id je obavezan' });
    }

    const updated = await terminiModel.upsertTerminiKolokvijuma(predmet_id, data);
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
    
    // Grupišemo predmete ili ih stavaljamo po sheet-ovima (npr. Informatika / Matematika)
    // Za primer: pravimo Sheet 'Informatika'
    const worksheet = workbook.addWorksheet('Termini kolokvijuma');

    // Definsanje zaglavlja (red 1 i red 2)
    worksheet.mergeCells('A1:A2'); worksheet.getCell('A1').value = 'Godina';
    worksheet.mergeCells('B1:B2'); worksheet.getCell('B1').value = 'Naziv predmeta';
    worksheet.mergeCells('C1:C2'); worksheet.getCell('C1').value = 'Broj studenata';

    worksheet.mergeCells('D1:F1'); worksheet.getCell('D1').value = 'Prvi kolokvijum';
    worksheet.getCell('D2').value = 'Najraniji datum';
    worksheet.getCell('E2').value = 'Trajanje (min)';
    worksheet.getCell('F2').value = 'Računarska sala';

    worksheet.mergeCells('G1:I1'); worksheet.getCell('G1').value = 'Drugi kolokvijum';
    worksheet.getCell('G2').value = 'Najraniji datum';
    worksheet.getCell('H2').value = 'Trajanje (min)';
    worksheet.getCell('I2').value = 'Računarska sala';

    worksheet.mergeCells('J1:L1'); worksheet.getCell('J1').value = 'Treći kolokvijum';
    worksheet.getCell('J2').value = 'Najraniji datum';
    worksheet.getCell('K2').value = 'Trajanje (min)';
    worksheet.getCell('L2').value = 'Računarska sala';

    worksheet.mergeCells('M1:O1'); worksheet.getCell('M1').value = 'Popravni kolokvijum (opciono)';
    worksheet.getCell('M2').value = 'U terminu ispita';
    worksheet.getCell('N2').value = 'Trajanje (min)';
    worksheet.getCell('O2').value = 'Računarska sala';

    worksheet.mergeCells('P1:P2'); worksheet.getCell('P1').value = 'Napomena';

    // Popunjavanje redova
    predmeti.forEach(p => {
      const t = p.terminiKolokvijuma || {};
      worksheet.addRow([
        `${p.godina}. godina`,
        p.naziv,
        p.broj_studenata || 0,
        t.k1_datum || '', t.k1_trajanje || '', t.k1_racunarska_sala ? 'Da' : 'Ne',
        t.k2_datum || '', t.k2_trajanje || '', t.k2_racunarska_sala ? 'Da' : 'Ne',
        t.k3_datum || '', t.k3_trajanje || '', t.k3_racunarska_sala ? 'Da' : 'Ne',
        t.popravni_u_terminu_ispita ? 'Da' : 'Ne', t.popravni_trajanje || '', t.popravni_racunarska_sala ? 'Da' : 'Ne',
        t.napomena || ''
      ]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Izbor_termina_kolokvijuma.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Greška pri izvozu u Excel:', error);
    res.status(500).json({ message: 'Greška pri generisanju Excel fajla' });
  }
};

module.exports = {
  getMojiTermini,
  saveTermini,
  exportExcel
};