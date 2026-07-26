import * as XLSX from 'xlsx';
import pool from '../db/pool.js';

export const importPredmetiExcel = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Molimo vas pošaljite Excel fajl.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]]; // Uzima prvi radni list (npr. OAS 2025-26)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    await client.query('BEGIN');

    // Dinamičke promenljive koje se menjaju u hodu
    let currentGodina = 1; 
    let currentSemestar = 'Zimski';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Spajamo tekst iz celog reda radi lakše provere naslova
      const rowText = row.map(cell => String(cell || '').trim()).join(' ');

      // 1. DETEKCIJA GODINE (npr. "I godina", "II godina", "III godina", "IV godina")
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

      // Indeksi iz tabele sa slike/fajla:
      // Index 1 = Šifra, Index 2 = Predmet, Index 3 = Status
      // Index 5 = Nastavnik (Profesor), Index 7 = Saradnik
      const sifra = row[1] ? String(row[1]).trim() : null;
      const naziv = row[2] ? String(row[2]).trim() : null;
      const status = row[3] ? String(row[3]).trim() : null;
      const nastavnikImePrezime = row[5] ? String(row[5]).trim() : null;
      const saradnikImePrezime = row[7] ? String(row[7]).trim() : null;

      // 3. UNOS SARADNIKA (Ažurira tabelu Profesor sa is_saradnik = true)
      if (saradnikImePrezime) {
        await findOrCreateProfesor(client, saradnikImePrezime, true);
      }

      // 4. UNOS PREDMETA I PROFESORA (Samo kada je prisutna šifra i nastavnik)
      if (sifra && naziv && nastavnikImePrezime) {
        // Očisti nevidljive tabulatore (\t) koje Excel zna da doda uz šifru
        const cistaSifra = sifra.replace(/\t/g, ''); 

        // Glavni Profesor
        const profesorId = await findOrCreateProfesor(client, nastavnikImePrezime, false);

        // Unos predmeta sa trenutno detektovanom godinom i semestrom
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
  if (t.includes('IV')) return 4;
  if (t.includes('III')) return 3;
  if (t.includes('II')) return 2;
  if (t.includes('I')) return 1;
  return null;
}

async function findOrCreateProfesor(client, punNaziv, isSaradnik) {
  // Sređivanje čišćenja viška razmaka/tabulatora
  const cistoIme = punNaziv.replace(/\s+/g, ' ').trim();
  const delovi = cistoIme.split(' ');
  const ime = delovi[0];
  const prezime = delovi.slice(1).join(' ') || 'Nepoznato';

  const existing = await client.query(
    `SELECT id FROM Profesor WHERE ime = $1 AND prezime = $2`,
    [ime, prezime]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO Profesor (ime, prezime, is_saradnik, email) 
     VALUES ($1, $2, $3, null) RETURNING id`,
    [ime, prezime, isSaradnik]
  );

  return inserted.rows[0].id;
}