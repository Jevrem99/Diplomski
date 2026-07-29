const XLSX = require('xlsx');
const pool = require('../db/connection.js');

// Lista reči iz zaglavlja koje moramo ignorisati
const IGNORISI_TEKST = [
  'предавања', 'наставник', 'сарадник', 'вежбе', 'шифра', 'предмет', 
  'статус предмета', 'бр. ч.', 'врста', 'срт', 'оас', 'рн', 'си', 'икт','ментор','O','И'
];

function jeZaglavljeIliPrazno(tekst) {
  if (!tekst) return true;
  const t = String(tekst).trim().toLowerCase();
  return IGNORISI_TEKST.includes(t);
}

const importPredmetiExcel = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Molimo vas pošaljite Excel fajl.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Uzima prvi radni list
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    await client.query('BEGIN');

    let currentGodina = 1; 
    let currentSemestar = 'Zimski';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Spajamo tekst celog reda radi lakše detekcije godine i semestra
      const rowText = row.map(cell => String(cell || '').trim()).join(' ');

      // 1. DETEKCIJA GODINE
      if (rowText.toLowerCase().includes('година') || rowText.toLowerCase().includes('godina')) {
        const detektovanaGodina = parseGodina(rowText);
        if (detektovanaGodina) {
          currentGodina = detektovanaGodina;
        }
      }

      // 2. DETEKCIJA SEMESTRA
      if (rowText.toLowerCase().includes('зимски') || rowText.toLowerCase().includes('zimski')) {
        currentSemestar = 'Zimski';
        continue;
      }
      if (rowText.toLowerCase().includes('летњи') || rowText.toLowerCase().includes('letnji')) {
        currentSemestar = 'Letnji';
        continue;
      }

      // 3. ČITANJE VREDNOSTI IZ REDA
      const sifra = row[1] ? String(row[1]).trim() : null;
      const naziv = row[2] ? String(row[2]).trim() : null;

      // STATUS (Gleda se kolona D tj. row[3], fallback je ćirilično 'И')
      const vrednostIzD = row[3] ? String(row[3]).trim() : '';
      const status = (!jeZaglavljeIliPrazno(vrednostIzD)) ? vrednostIzD : 'И';

      const nastavnikImePrezime = row[5] ? String(row[5]).trim() : null;
      const saradnikImePrezime = row[7] ? String(row[7]).trim() : null;

      // 4. UNOS SARADNIKA (Samo ako nije tekst iz zaglavlja!)
      if (saradnikImePrezime && !jeZaglavljeIliPrazno(saradnikImePrezime)) {
        await findOrCreateProfesor(client, saradnikImePrezime, true);
      }

      // 5. UNOS PREDMETA I NASTAVNIKA (Samo kada su prisutni validni podaci)
      if (
        sifra && !jeZaglavljeIliPrazno(sifra) &&
        naziv && !jeZaglavljeIliPrazno(naziv) &&
        nastavnikImePrezime && !jeZaglavljeIliPrazno(nastavnikImePrezime)
      ) {
        // Očisti nevidljive tabulatore (\t)
        const cistaSifra = sifra.replace(/\t/g, ''); 

        // Glavni Profesor -> isSaradnik = false
        const profesorId = await findOrCreateProfesor(client, nastavnikImePrezime, false);

        // Unos ili azuriranje predmeta
        await client.query(
          `INSERT INTO Predmet (sifra, naziv, godina, semestar, status, profesor_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (sifra) 
           DO UPDATE SET 
             naziv = EXCLUDED.naziv,
             godina = EXCLUDED.godina,
             semestar = EXCLUDED.semestar,
             status = EXCLUDED.status,
             profesor_id = EXCLUDED.profesor_id;`,
          [cistaSifra, naziv, currentGodina, currentSemestar, status, profesorId]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Uspešno uvezeni predmeti, profesori i saradnici za sve godine!' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Greška pri uvozu:', error);
    return res.status(500).json({ message: 'Greška pri obradi Excel fajla.', error: error.message });
  } finally {
    client.release();
  }
};

function parseGodina(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes('IV ГОДИНА') || t.includes('IV GODINA')) return 4;
  if (t.includes('III ГОДИНА') || t.includes('III GODINA')) return 3;
  if (t.includes('II ГОДИНА') || t.includes('II GODINA')) return 2;
  if (t.includes('I ГОДИНА') || t.includes('I GODINA')) return 1;
  return null;
}

async function findOrCreateProfesor(client, punNaziv, isSaradnik) {
  const cistoIme = punNaziv.replace(/\s+/g, ' ').trim();
  const delovi = cistoIme.split(' ');
  const ime = delovi[0];
  const prezime = delovi.slice(1).join(' ') || 'Nepoznato';

  // Provera da li profesor već postoji
  const existing = await client.query(
    `SELECT id, is_saradnik FROM Profesor WHERE ime = $1 AND prezime = $2`,
    [ime, prezime]
  );

  if (existing.rows.length > 0) {
    const prof = existing.rows[0];

    // Ako je bio označen kao saradnik, a sada se pojavio kao profesor, ažuriraj ga
    if (prof.is_saradnik && !isSaradnik) {
      await client.query(
        `UPDATE Profesor SET is_saradnik = false WHERE id = $1`,
        [prof.id]
      );
    }

    return prof.id;
  }

  // Ako ne postoji, ubacuje se nov
  const inserted = await client.query(
    `INSERT INTO Profesor (ime, prezime, is_saradnik, email) 
     VALUES ($1, $2, $3, null) RETURNING id`,
    [ime, prezime, isSaradnik]
  );

  return inserted.rows[0].id;
}

module.exports = {
  importPredmetiExcel
};