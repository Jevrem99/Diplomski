const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
dayjs.extend(isoWeek);
const ispitModel = require('../models/ispitModel');
const prisma = require('../db/prisma');
const { normalizujNazivSale, nadjiIliNapraviSalu } = require('../utils/sale');
const { proveriVremena, ocistiGrupaKljuc } = require('../utils/validators');
const { napraviRezervacije, hhmm: vremeHHMM } = require('../services/rezervacijeSala');
const { sendGrupniDezurstvoEmail, sendIzmenaDezurstvaEmail } = require('../services/emailService');
const { logAction } = require('../services/auditService');

exports.exportKalendar = async (req, res) => {
    try {
        // 1. Povlačenje svih ispita i predmeta iz baze
        const ispiti = await prisma.ispit.findMany({
            include: {
                predmet: true // Uključujemo predmet da dobijemo "naziv"
            },
            orderBy: {
                datum: 'asc'
            }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Raspored');

        // Postavljamo širinu kolona od ponedeljka do nedelje
        for (let i = 1; i <= 7; i++) {
            worksheet.getColumn(i).width = 25;
        }

        // 2. Kreiranje zaglavlja
        worksheet.mergeCells('A1:G1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'Распоред колоквијума на ОАС Информатика \nлетњи семестар 2025/26';
        titleCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        titleCell.font = { bold: true, size: 12 };
        worksheet.getRow(1).height = 40;

        worksheet.addRow([]); // Prazan red ispod naslova (Red 2)

        // 3. Grupisanje ispita po kalendarskim nedeljama
        const sedmice = {};

        ispiti.forEach(ispit => {
            const datum = dayjs(ispit.datum);
            const ponedeljak = datum.startOf('isoWeek').format('YYYY-MM-DD');

            if (!sedmice[ponedeljak]) {
                sedmice[ponedeljak] = {
                    datumi: [], // Sadržaće datume od ponedeljka do nedelje
                    dogadjaji: [[], [], [], [], [], [], []] // Matrica za događaje u danima (0-6)
                };

                // Generisanje datuma za celu nedelju (Ponedeljak - Nedelja)
                for (let i = 0; i < 7; i++) {
                    sedmice[ponedeljak].datumi.push(datum.startOf('isoWeek').add(i, 'day').toDate());
                }
            }

            const danIndex = datum.isoWeekday() - 1; // 0 = Ponedeljak, 6 = Nedelja

            // Formatiranje stringa prema tvom Excel fajlu
            const nazivPredmeta = ispit.predmet ? ispit.predmet.naziv : 'Непознат предмет';
            const tip = ispit.is_ispit ? 'испит' : 'I колоквијум';

            // Izvlačenje sati i minuta (npr. 16:00 -> 16h, 18:30 -> 18.30h)
            const satiSirovo = dayjs(ispit.vreme).format('H:mm');
            const satiFormatirano = satiSirovo.endsWith(':00')
                ? dayjs(ispit.vreme).format('H') + 'h'
                : satiSirovo.replace(':', '.') + 'h';

            const tekstCelije = `${nazivPredmeta}\n${tip} - ${satiFormatirano}`;

            // Guranje obaveze u taj dan
            sedmice[ponedeljak].dogadjaji[danIndex].push(tekstCelije);
        });

        // 4. Iscrtavanje redova u Excelu
        let currentRow = 3;

        for (const [ponedeljak, podaci] of Object.entries(sedmice)) {
            // A) Red sa imenima dana
            const dani = ['понедељак', 'уторак', 'среда', 'четвртак', 'петак', 'субота', 'недеља'];
            const daysRow = worksheet.getRow(currentRow);
            daysRow.values = dani;
            daysRow.alignment = { horizontal: 'center', vertical: 'middle' };
            daysRow.font = { bold: true };
            currentRow++;

            // B) Red sa tačnim datumima
            const datesRow = worksheet.getRow(currentRow);
            datesRow.values = podaci.datumi;
            datesRow.numFmt = 'dd.mm.yyyy'; // Formatiranje datuma kao u Excelu
            datesRow.alignment = { horizontal: 'center' };
            currentRow++;

            // C) Redovi sa ispitima/kolokvijumima
            const maxDogadjajaUDanu = Math.max(...podaci.dogadjaji.map(d => d.length), 1);

            for (let i = 0; i < maxDogadjajaUDanu; i++) {
                const redDogadjaja = [];
                for (let j = 0; j < 7; j++) {
                    redDogadjaja.push(podaci.dogadjaji[j][i] || '');
                }

                const eventRow = worksheet.getRow(currentRow);
                eventRow.values = redDogadjaja;

                eventRow.eachCell((cell) => {
                    cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
                });
                eventRow.height = 60; // Dovoljno visoko za \n
                currentRow++;
            }

            // D) Prazan red kao razmak pre sledeće nedelje
            worksheet.addRow([]);
            currentRow++;
        }

        // 5. Konfiguracija headera za browser preuzimanje
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + 'Raspored_kolokvijuma.xlsx'
        );

        // Prosleđivanje generisanog fajla na frontend
        await workbook.xlsx.write(res);

        res.end();

    } catch (error) {
        console.error('Greška pri generisanju kalendara:', error);
        res.status(500).json({ message: 'Greška pri generisanju Excel fajla.' });
    }
};

// Svi osim admina vide samo objavljene termine (nacrti su interni)
const jeAsistent = (req) => !req.user || req.user.uloga !== 'admin';

// Opcioni opseg datuma (?od=YYYY-MM-DD&do=YYYY-MM-DD) da kalendar ne mora da povlači celu tabelu
const opsegDatuma = (query) => {
    const where = {};
    const valid = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
    if (valid(query.od) || valid(query.do)) {
        where.datum = {};
        if (valid(query.od)) where.datum.gte = new Date(`${query.od}T00:00:00.000Z`);
        if (valid(query.do)) where.datum.lte = new Date(`${query.do}T00:00:00.000Z`);
    }
    return where;
};

const getAllIspiti = async (req, res) => {
    try {
        const where = opsegDatuma(req.query || {});
        // Asistenti vide samo objavljene termine (nacrti su interni)
        if (jeAsistent(req)) where.is_published = true;
        const ispiti = await ispitModel.getAllIspiti(where);
        res.status(200).json(ispiti);
    } catch (err) {
        console.error('Error fetching ispiti:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getIspitById = async (req, res) => {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'Nevalidan ID ispita' });
    try {
        const ispit = await ispitModel.getIspitById(id);
        if (!ispit || (jeAsistent(req) && !ispit.is_published)) return res.status(404).json({ error: 'Ispit not found' });
        res.status(200).json(ispit);
    } catch (err) {
        console.error(`Error fetching ispit ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const DEFAULT_TRAJANJE_MS = 2 * 60 * 60 * 1000; // ako nema vremena kraja, računamo 2h

const minutaOdPonoci = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();

// Time kolone stižu kao Date ili kao tekst "HH:MM:SS" (zbog result ekstenzije u db/prisma.js)
const vremeUDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    const t = String(v);
    const d = new Date(`1970-01-01T${t.length === 5 ? t + ':00' : t.substring(0, 8)}.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
};

const hhmm = (d) => (d ? d.toISOString().substring(11, 16) : '?');
const prikazDatuma = (dan) => dan.split('-').reverse().slice(0, 2).join('.') + '.';

// Vraća listu konflikata { tip: 'dezurstvo' | 'odsustvo' | 'sala', tekst } za dati termin:
//  - asistent ima obavezu/odsustvo (jedan dan, više dana ili celodnevno),
//  - asistent već dežura u istom terminu,
//  - ista sala je zauzeta drugim ispitom u istom terminu.
// excludeIspitId(s): ispiti koji se menjaju/brišu (ne računaju se kao konflikt sa samim sobom)
// grupa_kljuc: termini nastali jednim postavljanjem grupe predmeta dele salu, vreme i dežurne,
//              pa se međusobno ne prijavljuju kao konflikt
// planirani: termini koji se tek čuvaju u istoj seriji ({ datum, vreme, vreme_kraja, sala_id, dezurni_ids, naziv, saradnici })
const proveriKonflikte = async ({ datum, vreme, vreme_kraja, dezurni_ids, sala_id, excludeIspitId, excludeIspitIds = [], planirani = [], grupa_kljuc = null, db = prisma }) => {
    const dan = String(datum).split('T')[0];
    const ispitDatum = new Date(`${dan}T00:00:00.000Z`);
    const pocetak = formatTimeToDateTime(dan, vreme);
    if (!pocetak) return [];
    const kraj = formatTimeToDateTime(dan, vreme_kraja) || new Date(pocetak.getTime() + DEFAULT_TRAJANJE_MS);
    const ids = (dezurni_ids || []).map(Number).filter(Number.isInteger);
    const izuzeti = [...excludeIspitIds, ...(excludeIspitId ? [excludeIspitId] : [])].map(Number).filter(Number.isInteger);
    // NULL se u SQL-u ne poredi sa "različito od", pa se termini bez grupe navode izričito
    const vanGrupe = grupa_kljuc ? { OR: [{ grupa_kljuc: null }, { grupa_kljuc: { not: grupa_kljuc } }] } : {};
    const notIn = { ...(izuzeti.length > 0 ? { id: { notIn: izuzeti } } : {}), ...vanGrupe };
    const konflikti = [];
    const preklapa = (poc, zav) => minutaOdPonoci(poc) < minutaOdPonoci(kraj) && minutaOdPonoci(zav) > minutaOdPonoci(pocetak);
    const imenaSaradnika = new Map();

    // 1. Obaveze / odsustva
    if (ids.length > 0) {
        const obaveze = await db.obaveza.findMany({
            where: {
                saradnik_id: { in: ids },
                OR: [
                    { datum: ispitDatum, datum_do: null },
                    { datum: { lte: ispitDatum }, datum_do: { gte: ispitDatum } }
                ]
            },
            include: { saradnik: true }
        });

        obaveze.forEach((ob) => {
            const celodnevna = !ob.vreme_pocetka || !ob.vreme_kraja || ob.datum_do;
            if (celodnevna || preklapa(ob.vreme_pocetka, ob.vreme_kraja)) {
                const kada = celodnevna ? 'celog dana' : `${hhmm(ob.vreme_pocetka)}–${hhmm(ob.vreme_kraja)}`;
                konflikti.push({
                    tip: 'odsustvo',
                    tekst: `Asistent ${ob.saradnik.ime} ${ob.saradnik.prezime} je odsutan (${ob.tip_obaveze || 'obaveza'}, ${prikazDatuma(dan)} ${kada}).`
                });
            }
        });

        // 2. Druga dežurstva u istom terminu (već sačuvana u bazi)
        const drugaDezurstva = await db.dezurstva.findMany({
            where: { saradnik_id: { in: ids }, ispit: { datum: ispitDatum, ...notIn } },
            include: { saradnik: true, ispit: { include: { predmet: true } } }
        });

        drugaDezurstva.forEach((dez) => {
            const poc = vremeUDate(dez.ispit.vreme);
            if (!poc) return;
            const zav = vremeUDate(dez.ispit.vreme_kraja) || new Date(poc.getTime() + DEFAULT_TRAJANJE_MS);
            if (preklapa(poc, zav)) {
                konflikti.push({
                    tip: 'dezurstvo',
                    tekst: `Asistent ${dez.saradnik.ime} ${dez.saradnik.prezime} već dežura na predmetu „${dez.ispit.predmet?.naziv || '?'}“ (${hhmm(poc)}–${hhmm(zav)}).`
                });
            }
        });
    }

    // 3. Zauzeta sala drugim ispitom (već sačuvanim)
    if (sala_id) {
        const uSali = await db.ispit.findMany({
            where: { sala_id: Number(sala_id), datum: ispitDatum, ...notIn },
            include: { predmet: true, sala: true }
        });
        uSali.forEach((i) => {
            const poc = vremeUDate(i.vreme);
            if (!poc) return;
            const zav = vremeUDate(i.vreme_kraja) || new Date(poc.getTime() + DEFAULT_TRAJANJE_MS);
            if (preklapa(poc, zav)) {
                konflikti.push({
                    tip: 'sala',
                    tekst: `Sala ${i.sala?.naziv || ''} je zauzeta: „${i.predmet?.naziv || 'drugi ispit'}“ (${hhmm(poc)}–${hhmm(zav)}).`
                });
            }
        });
    }

    // 4. Isti konflikti sa terminima koji se čuvaju u istoj seriji (još nisu u bazi)
    for (const o of planirani) {
        if (String(o.datum).split('T')[0] !== dan) continue;
        if (grupa_kljuc && o.grupa_kljuc === grupa_kljuc) continue;
        const poc = formatTimeToDateTime(dan, o.vreme);
        if (!poc) continue;
        const zav = formatTimeToDateTime(dan, o.vreme_kraja) || new Date(poc.getTime() + DEFAULT_TRAJANJE_MS);
        if (!preklapa(poc, zav)) continue;
        if (sala_id && o.sala_id && Number(o.sala_id) === Number(sala_id)) {
            konflikti.push({ tip: 'sala', tekst: `Sala ${o.salaNaziv || ''} je zauzeta: „${o.naziv}“ (${hhmm(poc)}–${hhmm(zav)}).` });
        }
        const zajednicki = ids.filter((id) => (o.dezurni_ids || []).map(Number).includes(id));
        zajednicki.forEach((id) => {
            konflikti.push({
                tip: 'dezurstvo',
                tekst: `${(o.saradnici && o.saradnici.get(id)) || 'Asistent'} je istovremeno raspoređen i na „${o.naziv}“ (${hhmm(poc)}–${hhmm(zav)}).`
            });
        });
    }

    return konflikti;
};

const tekstovi = (konflikti) => [...new Set(konflikti.map((k) => k.tekst))];

// Pronađi (ili napravi) salu po nazivu; vraća id ili null. cache izbegava ponovljene upite u petlji.
const odrediSalaId = async (sala, cache = new Map(), db = prisma) => {
    const naziv = typeof sala === 'object' && sala !== null ? sala.naziv : sala;
    if (!naziv || naziv === 'Bez sale') return null;
    const nadjena = await nadjiIliNapraviSalu(db, naziv, cache);
    return nadjena ? nadjena.id : null;
};

const createIspit = async (req, res) => {
    const { predmet_id, datum, vreme, is_ispit, tip_kolokvijuma, sala, date, startTime, room, vreme_kraja, endTime, dezurni_ids } = req.body;
    const grupaKljuc = ocistiGrupaKljuc(req.body.grupa_kljuc);

    const finalDatum = datum || date;
    const finalVreme = vreme || startTime;
    const finalSala = sala || room;
    const finalVremeKraja = vreme_kraja || endTime;
    const finalTipKolokvijuma = tip_kolokvijuma || 'I';

    if (!finalDatum || Number.isNaN(new Date(finalDatum).getTime()) || !finalVreme) {
        return res.status(400).json({ error: 'Datum i vreme početka su obavezni.' });
    }
    const greskaVremena = proveriVremena(finalVreme, finalVremeKraja);
    if (greskaVremena) return res.status(400).json({ error: greskaVremena, polja: { vreme_kraja: greskaVremena } });
    try {
        let finalDezurni = dezurni_ids || [];

        // AUTOMATSKA DODELA
        if (!dezurni_ids) {
            const predmet = await prisma.predmet.findUnique({
                where: { id: Number(predmet_id) },
                include: { saradnici: true }
            });
            if (predmet && predmet.saradnici) {
                finalDezurni = predmet.saradnici.map(s => s.id);
            }
        }

        const salaId = await odrediSalaId(finalSala);

        // PROVERA KONFLIKATA
        const konflikti = await proveriKonflikte({
            datum: finalDatum, vreme: finalVreme, vreme_kraja: finalVremeKraja, dezurni_ids: finalDezurni, sala_id: salaId,
            grupa_kljuc: grupaKljuc
        });
        if (konflikti.length > 0 && req.query.force !== '1') {
            return res.status(409).json({
                error: 'Konflikt u rasporedu',
                poruke: tekstovi(konflikti),
                konflikti
            });
        }

        const newIspit = await ispitModel.createIspit(
            predmet_id,
            finalDatum,
            finalVreme,
            finalVremeKraja,
            is_ispit ?? true,
            finalTipKolokvijuma,
            salaId,
            finalDezurni,
            prisma,
            grupaKljuc
        );
        await logAction(
            req.user?.username || 'Korisnik',
            'CREATE',
            'Ispit',
            `Zakazan termin za datum ${finalDatum} u ${finalVreme}h`
        );
        res.status(201).json(newIspit);
    } catch (err) {
        console.error('Error creating ispit:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

function formatTimeToDateTime(datumStr, timeStr) {
    if (!timeStr) return null;
    if (timeStr.includes('T')) {
        const d = new Date(timeStr);
        return isNaN(d.getTime()) ? null : d;
    }

    const baseDate = datumStr ? datumStr.split('T')[0] : '1970-01-01';
    let t = timeStr.trim();
    if (t.length === 5) t += ':00'; // "09:45" -> "09:45:00"

    const d = new Date(`${baseDate}T${t}.000Z`);
    return isNaN(d.getTime()) ? null : d;
}

const updateIspit = async (req, res) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'Nevalidan ID ispita' });
  try {
    const body = req.body;
    const numericId = Number(id);

    // Dohvaćamo postojeće stanje iz baze kao rezervu
    const postojeciIspit = await prisma.ispit.findUnique({
      where: { id: numericId }
    });

    if (!postojeciIspit) {
      return res.status(404).json({ error: 'Ispit nije pronađen' });
    }

    // 1. Datum
    let noviDatum = new Date(`${String(postojeciIspit.datum).split("T")[0]}T00:00:00.000Z`);
    if (body.datum) {
      const dStr = String(body.datum).split('T')[0];
      const dObj = new Date(dStr + 'T00:00:00.000Z');
      if (!isNaN(dObj.getTime())) {
        noviDatum = dObj;
      }
    }

    // 2. Vrijeme početka i Vrijeme kraja (PostgreSQL @db.Time(6) zahtijeva 1970-01-01 bazu)
    const parseTimeToDbTime = (timeVal, fallbackDate) => {
      if (timeVal === null) return null;
      if (!timeVal || String(timeVal).trim() === '' || timeVal === '00:00') {
        return vremeUDate(fallbackDate);
      }
      
      let str = String(timeVal).trim();
      if (str.includes('T')) {
        str = str.substring(11, 16);
      } else {
        str = str.substring(0, 5);
      }
      
      return new Date('1970-01-01T' + str + ':00.000Z');
    };

    const novoVreme = parseTimeToDbTime(body.vreme, postojeciIspit.vreme);
    const novoVremeKraja = parseTimeToDbTime(
      body.vreme_kraja !== undefined ? body.vreme_kraja : body.vremeKraja, 
      postojeciIspit.vreme_kraja
    );
    if (novoVreme && novoVremeKraja && new Date(novoVremeKraja).getTime() <= new Date(novoVreme).getTime()) {
      const g = 'Vreme kraja mora biti posle vremena početka.';
      return res.status(400).json({ error: g, polja: { vreme_kraja: g } });
    }

    // 3. Sala
    let salaConnect = undefined;
    if (body.sala_id && Number(body.sala_id)) {
      salaConnect = { connect: { id: Number(body.sala_id) } };
    } else if (body.sala && typeof body.sala === 'string' && body.sala !== 'Bez sale') {
      const pronadjenaSala = await prisma.sala.findFirst({
        where: { naziv: { equals: normalizujNazivSale(body.sala), mode: 'insensitive' } }
      });
      if (pronadjenaSala) {
        salaConnect = { connect: { id: pronadjenaSala.id } };
      }
    }

    // 4. Predmet
    let predmetConnect = undefined;
    const pId = Number(body.predmet_id || body.predmetId || body.predmet?.id);
    if (pId) {
      predmetConnect = { connect: { id: pId } };
    }

    // 5. Dežurni - Zadržana ispravna varijabla
    const dezurniIds = (body.dezurni_ids || body.dezurni || [])
      .map(d => (typeof d === 'object' ? d.id : Number(d)))
      .filter(Boolean);

    // Ključ grupe: ako ga zahtev ne pominje, ostaje postojeći
    const grupaKljuc = Object.prototype.hasOwnProperty.call(body, 'grupa_kljuc')
      ? ocistiGrupaKljuc(body.grupa_kljuc)
      : postojeciIspit.grupa_kljuc;

    // Provera konflikata (ispit koji menjamo se ne računa kao konflikt sam sa sobom)
    const salaZaProveru = salaConnect ? salaConnect.connect.id : postojeciIspit.sala_id;
    const konflikti = await proveriKonflikte({
      datum: noviDatum instanceof Date ? noviDatum.toISOString() : String(noviDatum),
      vreme: vremeUDate(novoVreme)?.toISOString().substring(11, 19) || null,
      vreme_kraja: vremeUDate(novoVremeKraja)?.toISOString().substring(11, 19) || null,
      dezurni_ids: dezurniIds,
      sala_id: salaZaProveru,
      excludeIspitId: numericId,
      grupa_kljuc: grupaKljuc
    });
    if (konflikti.length > 0 && req.query.force !== '1') {
      return res.status(409).json({ error: 'Konflikt u rasporedu', poruke: tekstovi(konflikti), konflikti });
    }

    // Izmena objavljenog termina: vraća se u nacrt i označava kao izmenjen da se ponovo objavi uz obaveštenje
    const izmenaObjavljenog = postojeciIspit.is_published
      ? { is_published: false, is_izmenjen: true }
      : {};

    const updated = await prisma.$transaction(async (tx) => {
      await tx.dezurstva.deleteMany({ where: { ispit_id: numericId } });
      return tx.ispit.update({
        where: { id: numericId },
        data: {
          datum: noviDatum,
          vreme: novoVreme,
          vreme_kraja: novoVremeKraja,
          is_ispit: body.is_ispit ?? true,
          tip_kolokvijuma: body.tip_kolokvijuma || 'I',
          grupa_kljuc: grupaKljuc,
          ...(predmetConnect ? { predmet: predmetConnect } : {}),
          ...(salaConnect ? { sala: salaConnect } : {}),
          ...izmenaObjavljenog,
          dezurstva: {
            create: dezurniIds.map(dId => ({
              saradnik_id: Number(dId)
            }))
          }
        },
        include: {
          predmet: true,
          sala: true,
          dezurstva: { include: { saradnik: true } }
        }
      });
    });

    await logAction(
      req.user?.username || 'Korisnik',
      'UPDATE',
      'Ispit',
      `Izmenjen ispit/kolokvijum sa ID-jem ${numericId}`
    );

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Greška pri izmjeni ispita:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteIspit = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedIspit = await ispitModel.deleteIspit(id);
        if (!deletedIspit || deletedIspit.count === 0) {
            return res.status(404).json({ error: 'Ispit not found' });
        }
        await logAction(
            req.user?.username || 'Korisnik',
            'DELETE',
            'Ispit',
            `Obrisan ispit/kolokvijum sa ID-jem ${id}`
        );
        res.status(200).json(deletedIspit);
    } catch (err) {
        console.error(`Error deleting ispit with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const saveBulkIspiti = async (req, res) => {
    const ispitiNiz = req.body;
    if (!Array.isArray(ispitiNiz) || ispitiNiz.length === 0) {
        return res.status(400).json({ error: 'Očekuje se neprazna lista termina.' });
    }
    try {
        const salaCache = new Map();

        // 1. Priprema + provera konflikata za sve termine pre bilo kakvog upisa
        const pripremljeni = [];
        const sviKonflikti = [];
        for (const ispit of ispitiNiz) {
            const datum = ispit.datum || ispit.date;
            const vreme = ispit.vreme || ispit.startTime;
            const vremeKraja = ispit.vreme_kraja || ispit.endTime;
            if (!datum || !vreme || Number.isNaN(new Date(datum).getTime())) {
                return res.status(400).json({ error: 'Svaki termin mora imati datum i vreme početka.' });
            }
            const greskaVremena = proveriVremena(vreme, vremeKraja);
            if (greskaVremena) return res.status(400).json({ error: `${greskaVremena} (termin: ${ispit.title || ispit.naziv || datum})` });
            const salaId = await odrediSalaId(ispit.sala || ispit.room, salaCache);
            const dezurni = ispit.dezurni_ids || [];
            const grupaKljuc = ocistiGrupaKljuc(ispit.grupa_kljuc);
            const konflikti = await proveriKonflikte({ datum, vreme, vreme_kraja: vremeKraja, dezurni_ids: dezurni, sala_id: salaId, grupa_kljuc: grupaKljuc });
            sviKonflikti.push(...konflikti);
            pripremljeni.push({ ispit, datum, vreme, vremeKraja, salaId, dezurni, grupaKljuc });
        }
        if (sviKonflikti.length > 0 && req.query.force !== '1') {
            return res.status(409).json({ error: 'Konflikt u rasporedu', poruke: tekstovi(sviKonflikti), konflikti: sviKonflikti });
        }

        // 2. Upis svih termina u jednoj transakciji (ili sve ili ništa)
        const sacuvaniIspiti = await prisma.$transaction(async (tx) => {
            const rezultat = [];
            for (const p of pripremljeni) {
                rezultat.push(await ispitModel.createIspit(
                    p.ispit.predmet_id,
                    p.datum,
                    p.vreme,
                    p.vremeKraja,
                    p.ispit.is_ispit ?? true,
                    p.ispit.tip_kolokvijuma || 'I',
                    p.salaId,
                    p.dezurni,
                    tx,
                    p.grupaKljuc
                ));
            }
            return rezultat;
        });

        await logAction(
            req.user?.username || 'Korisnik',
            'CREATE',
            'Raspored',
            `Sačuvano ${sacuvaniIspiti.length} novih termina na rasporedu`
        );
        res.status(201).json(sacuvaniIspiti);
    } catch (err) {
        console.error('Error in bulk save:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// POST /ispit/proveri-konflikte  { novi: [...], izmenjeni: [...], obrisani: [id,...] }
// Ništa ne čuva - samo vraća konflikte cele serije izmena, da ih admin vidi pre čuvanja.
const proveriRaspored = async (req, res) => {
    try {
        const { novi = [], izmenjeni = [], obrisani = [] } = req.body || {};
        const salaCache = new Map();
        const nazivSala = new Map();

        const trazi = async (sala) => {
            const naziv = typeof sala === 'object' && sala !== null ? sala.naziv : sala;
            if (!naziv || naziv === 'Bez sale') return { id: null, naziv: '' };
            const kljuc = normalizujNazivSale(naziv).toLowerCase();
            if (!salaCache.has(kljuc)) {
                const nadjena = await prisma.sala.findFirst({ where: { naziv: { equals: normalizujNazivSale(naziv), mode: 'insensitive' } } });
                salaCache.set(kljuc, nadjena ? nadjena.id : null);
            }
            return { id: salaCache.get(kljuc), naziv };
        };

        // Normalizacija jednog termina iz tela zahteva (isti oblici kao u bulk/update)
        const predmetNazivi = new Map();
        const normalizuj = async (t, id = null) => {
            const datum = t.datum || t.date;
            const vreme = t.vreme || t.startTime;
            if (!datum || !vreme) return null;
            let salaId = t.sala_id ? Number(t.sala_id) : null;
            let salaNaziv = '';
            if (!salaId) {
                const r = await trazi(t.sala || t.room);
                salaId = r.id;
                salaNaziv = r.naziv;
            }
            const predmetId = Number(t.predmet_id || t.predmetId || t.predmet?.id) || null;
            if (predmetId && !predmetNazivi.has(predmetId)) {
                const p = await prisma.predmet.findUnique({ where: { id: predmetId } });
                predmetNazivi.set(predmetId, p ? p.naziv : '?');
            }
            const dezurni = (t.dezurni_ids || t.dezurni || []).map((d) => (typeof d === 'object' ? d.id : Number(d))).filter(Boolean);
            return {
                id,
                datum: String(datum).split('T')[0],
                vreme: String(vreme).includes('T') ? String(vreme).substring(11, 16) : String(vreme).substring(0, 5),
                vreme_kraja: (t.vreme_kraja || t.endTime || t.vremeKraja)
                    ? String(t.vreme_kraja || t.endTime || t.vremeKraja).replace(/^.*T/, '').substring(0, 5)
                    : null,
                sala_id: salaId,
                salaNaziv,
                dezurni_ids: dezurni,
                grupa_kljuc: ocistiGrupaKljuc(t.grupa_kljuc),
                naziv: predmetNazivi.get(predmetId) || t.title || 'Ispit'
            };
        };

        const planirani = [];
        for (const t of novi) { const n = await normalizuj(t); if (n) planirani.push(n); }
        for (const t of izmenjeni) {
            if (!t.id || String(t.id).startsWith('temp_')) continue;
            const n = await normalizuj(t, Number(t.id));
            if (n) planirani.push(n);
        }

        // imena asistenata za poruke o konfliktima unutar serije
        const sviIds = [...new Set(planirani.flatMap((p) => p.dezurni_ids))];
        const profesori = sviIds.length ? await prisma.profesor.findMany({ where: { id: { in: sviIds } } }) : [];
        const imena = new Map(profesori.map((p) => [p.id, `Asistent ${p.ime} ${p.prezime}`]));
        planirani.forEach((p) => { p.saradnici = imena; });

        const izuzeti = [...obrisani.map(Number), ...planirani.filter((p) => p.id).map((p) => p.id)];
        const rezultat = [];
        for (const p of planirani) {
            const konflikti = await proveriKonflikte({
                datum: p.datum, vreme: p.vreme, vreme_kraja: p.vreme_kraja, dezurni_ids: p.dezurni_ids, sala_id: p.sala_id,
                excludeIspitIds: izuzeti,
                grupa_kljuc: p.grupa_kljuc,
                planirani: planirani.filter((o) => o !== p)
            });
            if (konflikti.length > 0) {
                rezultat.push({ naziv: p.naziv, datum: p.datum, vreme: p.vreme, vreme_kraja: p.vreme_kraja, konflikti });
            }
        }

        res.status(200).json({ konflikti: rezultat });
    } catch (err) {
        console.error('Greška pri proveri rasporeda:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const publishAll = async (req, res) => {
    try {
        const draftIspiti = await prisma.ispit.findMany({
            where: { is_published: false },
            include: {
                predmet: { include: { profesor: true, terminiKolokvijuma: true } },
                sala: true,
                dezurstva: { include: { saradnik: true } }
            }
        });

        if (draftIspiti.length === 0) {
            return res.status(200).json({ message: 'Nema novih termina za objavljivanje.', objavljeno: 0 });
        }

        // Rezervacije sala za kolokvijume koji se sada objavljuju (JSON za administratora fakulteta); ispiti se ne računaju
        const rezervacije = napraviRezervacije(draftIspiti, { objavio: req.user?.username || null });

        const saradniciMap = new Map();

        draftIspiti.forEach(ispit => {
            const datumStr = ispit.datum;
            // vreme stiže iz baze kao tekst ili kao Date; oba se čitaju (inače bi vreme kraja ispadalo prazno)
            const vremeStr = vremeHHMM(ispit.vreme) || '00:00';
            const vremeKrajaStr = vremeHHMM(ispit.vreme_kraja) || '';
            const salaNaziv = ispit.sala?.naziv || 'Bez sale';
            const predmetNaziv = ispit.predmet?.naziv || 'Ispit';

            ispit.dezurstva.forEach(d => {
                if (d.saradnik && d.saradnik.email) {
                    const sId = d.saradnik.id;
                    if (!saradniciMap.has(sId)) {
                        saradniciMap.set(sId, {
                            email: d.saradnik.email,
                            imePrezime: `${d.saradnik.ime} ${d.saradnik.prezime}`,
                            dezurstva: []
                        });
                    }
                    saradniciMap.get(sId).dezurstva.push({
                        predmet: predmetNaziv,
                        datum: datumStr,
                        vreme: vremeStr,
                        vremeKraja: vremeKrajaStr,
                        sala: salaNaziv,
                        isIzmenjen: ispit.is_izmenjen
                    });
                }
            });
        });

        const result = await prisma.ispit.updateMany({
            where: { id: { in: draftIspiti.map((i) => i.id) } },
            data: {
                is_published: true,
                is_izmenjen: false 
            }
        });

        // Mejlovi se šalju paralelno; neuspeh jednog ne ruši objavljivanje, ali se beleži
        const slanja = await Promise.allSettled(
            [...saradniciMap.values()].map((data) => sendGrupniDezurstvoEmail(data.email, data.imePrezime, data.dezurstva))
        );
        const neuspela = slanja.filter((r) => r.status === 'rejected').length;
        if (neuspela > 0) console.error(`Nije poslato ${neuspela} od ${slanja.length} obaveštenja.`);
        await logAction(
            req.user?.username || 'Korisnik',
            'PUBLISH',
            'Raspored',
            `Objavljen raspored sa ${result.count} ispita i poslata obaveštenja saradnicima`
        );
        res.status(200).json({
            message: `Uspešno objavljeno ${result.count} ispita i poslata zbirna obaveštenja!`,
            objavljeno: result.count,
            rezervacije
        });
    } catch (err) {
        console.error('Greška pri objavljivanju:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /ispit/rezervacije-sala?od=GGGG-MM-DD&do=GGGG-MM-DD
// Rezervacije svih OBJAVLJENIH kolokvijuma u periodu (podrazumevano od danas): za ponovno preuzimanje fajla.
const getRezervacijeSala = async (req, res) => {
    try {
        const danas = new Date().toISOString().substring(0, 10);
        const od = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.od || '')) ? req.query.od : danas;
        const doDatuma = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.do || '')) ? req.query.do : null;
        const ispiti = await prisma.ispit.findMany({
            where: {
                is_ispit: false,
                is_published: true,
                datum: { gte: new Date(`${od}T00:00:00.000Z`), ...(doDatuma ? { lte: new Date(`${doDatuma}T00:00:00.000Z`) } : {}) }
            },
            include: { predmet: { include: { profesor: true, terminiKolokvijuma: true } }, sala: true }
        });
        res.status(200).json(napraviRezervacije(ispiti, { objavio: req.user?.username || null }));
    } catch (err) {
        console.error('Greška pri pravljenju rezervacija sala:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getZauzetiTermini = async (req, res) => {
    try {
        const { sala_id } = req.query;
        const whereClause = { ...(sala_id ? { sala_id: Number(sala_id) } : {}), ...opsegDatuma(req.query) };

        const redovnaNastava = await prisma.redovnaNastava.findMany({
            where: whereClause,
            include: { sala: true }
        });

        res.status(200).json(redovnaNastava);
    } catch (err) {
        console.error('Greška pri dohvatanju zauzetih termina:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        const [totalIspiti, totalSaradnici, najcesci] = await Promise.all([
            prisma.ispit.count(),
            prisma.profesor.count(),
            prisma.dezurstva.groupBy({
                by: ['saradnik_id'],
                where: { saradnik_id: { not: null } },
                _count: { _all: true },
                orderBy: { _count: { saradnik_id: 'desc' } },
                take: 1
            })
        ]);

        let topDezurni = '-';
        if (najcesci.length > 0) {
            const prof = await prisma.profesor.findUnique({ where: { id: najcesci[0].saradnik_id } });
            if (prof) topDezurni = `${prof.ime || ''} ${prof.prezime || ''}`.trim() + ` (${najcesci[0]._count._all})`;
        }

        res.status(200).json({
            totalIspiti,
            totalSaradnici,
            topDezurni
        });
    } catch (error) {
        console.error("Greška pri statistici:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    _proveriKonflikte: proveriKonflikte,
    proveriRaspored,
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit,
    saveBulkIspiti,
    publishAll,
    getRezervacijeSala,
    getZauzetiTermini,
    getDashboardStats
};