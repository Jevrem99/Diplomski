
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
dayjs.extend(isoWeek);
const ispitModel = require('../models/ispitModel');
const prisma = require('../db/prisma');
const { sendGrupniDezurstvoEmail, sendIzmenaDezurstvaEmail } = require('../services/emailService'); // <--- DODAJ OVDE
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
                for(let i = 0; i < 7; i++) {
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
            
            const tekstCelije = `\({nazivPredmeta}\n -\){tip} - ${satiFormatirano}`;
            
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
            // Pronalazimo dan sa najviše ispita u ovoj nedelji kako bismo znali koliko redova ispod datuma nam treba
            const maxDogadjajaUDanu = Math.max(...podaci.dogadjaji.map(d => d.length), 1);
            
            for (let i = 0; i < maxDogadjajaUDanu; i++) {
                const redDogadjaja = [];
                for (let j = 0; j < 7; j++) {
                    // Uzimamo i-ti ispit za j-ti dan. Ako ga nema, ide prazna ćelija
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
const getAllIspiti = async (req, res) => {
    try {
        const ispiti = await ispitModel.getAllIspiti();
        res.status(200).json(ispiti);
    } catch (err) {
        console.error('Error fetching ispiti:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getIspitById = async (req, res) => {
    const { id } = req.params;
    try {

        const ispit = await ispitModel.getIspitById(id);
        if (!ispit) return res.status(404).json({ error: 'Ispit not found' });
        res.status(200).json(ispit);
    } catch (err) {
        console.error(`Error fetching ispit ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
const proveriKonflikteAsistenata = async (datum, vreme, vreme_kraja, dezurni_ids) => {
    if (!dezurni_ids || dezurni_ids.length === 0) return [];

    const konflikti = [];
    const ispitDatum = new Date(datum);
    const pocetak = new Date(`${datum}T${vreme}Z`);
    const kraj = vreme_kraja ? new Date(`${datum}T${vreme_kraja}Z`) : new Date(pocetak.getTime() + 2 * 60 * 60 * 1000); // Default 2h ako nema kraja

    // 1. Provera odsustava / obaveza
    const obaveze = await prisma.obaveza.findMany({
        where: {
            saradnik_id: { in: dezurni_ids.map(Number) },
            datum: ispitDatum,
            // Logika za preklapanje vremena (pocetak1 < kraj2 && kraj1 > pocetak2)
            vreme_pocetka: { lt: kraj },
            vreme_kraja: { gt: pocetak }
        },
        include: { saradnik: true }
    });

    obaveze.forEach(ob => {
        konflikti.push(`Asistent ${ob.saradnik.ime} ${ob.saradnik.prezime} ima obavezu/odsustvo u tom terminu (${ob.tip_obaveze}).`);
    });

    // 2. Provera drugih dezurstava (ispita) u istom terminu
    const drugaDezurstva = await prisma.dezurstva.findMany({
        where: {
            saradnik_id: { in: dezurni_ids.map(Number) },
            ispit: {
                datum: ispitDatum,
                vreme: { lt: kraj },
                vreme_kraja: { gt: pocetak }
            }
        },
        include: { saradnik: true, ispit: { include: { predmet: true } } }
    });

    drugaDezurstva.forEach(dez => {
        konflikti.push(`Asistent ${dez.saradnik.ime} ${dez.saradnik.prezime} vec dezura na predmetu ${dez.ispit.predmet.naziv} u tom terminu.`);
    });

    return konflikti;
};
const createIspit = async (req, res) => {
    const { predmet_id, datum, vreme, is_ispit,tip_kolokvijuma, sala, date, startTime, room, vreme_kraja, endTime, dezurni_ids } = req.body;
   
    const finalDatum = datum || date;
    const finalVreme = vreme || startTime;
    const finalSala = sala || room;
    const finalVremeKraja = vreme_kraja || endTime;
    const finalTipKolokvijuma = tip_kolokvijuma || 'I';
    try {
        let finalDezurni = dezurni_ids || [];

        // AUTOMATSKA DODELA: Ako nisu prosleđeni dežurni, vučemo ih sa predmeta
        if (!dezurni_ids) {
            const predmet = await prisma.predmet.findUnique({
                where: { id: Number(predmet_id) },
                include: { saradnici: true }
            });
            if (predmet && predmet.saradnici) {
                finalDezurni = predmet.saradnici.map(s => s.id);
            }
        }

        // PROVERA KONFLIKATA
        const konflikti = await proveriKonflikteAsistenata(finalDatum, finalVreme, finalVremeKraja, finalDezurni);
        if (konflikti.length > 0) {
            return res.status(409).json({ 
                error: 'Konflikt u rasporedu', 
                poruke: konflikti 
            });
        }

        // Kreiranje ispita i dežurstava preko modela
        const newIspit = await ispitModel.createIspit(
            predmet_id, 
            finalDatum, 
            finalVreme, 
            finalVremeKraja,
            finalTipKolokvijuma,
            is_ispit ?? true, 
            finalSala,
            finalDezurni // Prosleđujemo konačan niz
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

const updateIspit = async (req, res) => {
    const { id } = req.params;
    const { predmet_id, datum, vreme, vreme_kraja, is_ispit,tip_kolokvijuma, sala, room, dezurni_ids } = req.body;
    try {
        const izabranaSala = sala || room;
        let salaId = null;
        const salaNaziv = typeof izabranaSala === 'object' && izabranaSala !== null 
             ? izabranaSala.naziv 
             : izabranaSala;

        if (salaNaziv && salaNaziv !== 'Bez sale') {
            let postojecaSala = await prisma.sala.findUnique({
                where: { naziv: salaNaziv }
            });
             
            if (!postojecaSala) {
                postojecaSala = await prisma.sala.create({
                    data: { naziv: salaNaziv }
                });
            }
            salaId = postojecaSala.id;
        }

        // Pozivamo model funkciju umesto direktnog prisma.ispit.update
        const updatedIspit = await ispitModel.updateIspit(
            id,
            predmet_id,
            datum,
            vreme,
            vreme_kraja,
            tip_kolokvijuma || 'I',
            is_ispit ?? true,
            salaId,
            dezurni_ids || []
        );
        await logAction(
            req.user?.username || 'Korisnik',
            'UPDATE',
            'Ispit',
            `Izmenjen termin ID ${id} (${datum} u ${vreme}h, sala: ${salaNaziv || 'Bez sale'})`
        );
        res.status(200).json(updatedIspit);
    } catch (err) {
        console.error(`Error updating ispit ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
const deleteIspit = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedIspit = await ispitModel.deleteIspit(id);
        if (!deletedIspit) {
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
    try {
        const sacuvaniIspiti = [];
        for (let ispit of ispitiNiz) {
            const izabranaSala = ispit.sala || ispit.room;
            let salaId = null;
            const salaNaziv = typeof izabranaSala === 'object' && izabranaSala !== null 
                ? izabranaSala.naziv 
                : izabranaSala;

            if (salaNaziv && salaNaziv !== 'Bez sale') {
                let postojecaSala = await prisma.sala.findUnique({
                    where: { naziv: salaNaziv }
                });
                if (!postojecaSala) {
                    postojecaSala = await prisma.sala.create({
                        data: { naziv: salaNaziv }
                    });
                }
                salaId = postojecaSala.id;
            }

            const newIspit = await ispitModel.createIspit(
                ispit.predmet_id,
                ispit.datum,
                ispit.vreme || ispit.startTime,
                ispit.vreme_kraja || ispit.endTime,
                ispit.is_ispit ?? true,
                ispit.tip_kolokvijuma || 'I',
                salaId,
                ispit.dezurni_ids || []
            );

            // NEMA VIŠE SLANJA MEJLOVA OVDE! (Obrisan je ceo blok sa sendGrupniDezurstvoEmail)

            sacuvaniIspiti.push(newIspit);
        }
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
const publishAll = async (req, res) => {
    try {
        const draftIspiti = await prisma.ispit.findMany({
            where: { is_published: false },
            include: {
                predmet: true,
                sala: true,
                dezurstva: { include: { saradnik: true } }
            }
        });

        if (draftIspiti.length === 0) {
            return res.status(200).json({ message: 'Nema novih ispita za objavljivanje.' });
        }

        // Mapiramo dežurstva po saradniku da im pošaljemo jedinstven spisak
        const saradniciMap = new Map();

        draftIspiti.forEach(ispit => {
            const datumStr = ispit.datum;
            const vremeStr = ispit.vreme ? (typeof ispit.vreme === 'string' ? ispit.vreme.substring(0, 5) : '00:00') : '00:00';
            
            // Dodajemo parsiranje vremena kraja
            const vremeKrajaStr = ispit.vreme_kraja ? (typeof ispit.vreme_kraja === 'string' ? ispit.vreme_kraja.substring(0, 5) : '') : '';
            
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
                        isIzmenjen: ispit.is_izmenjen // <--- PROSLEĐUJEMO FLAG
                    });
                }
            });
        });

        // Prebacujemo ispite u objavljeno
        const result = await prisma.ispit.updateMany({
            where: { is_published: false },
            data: { 
                is_published: true,
                is_izmenjen: false // <--- Resetuje se nakon objavljivanja
            }
        });

        // Šaljemo po JEDAN grupni mejl svakom saradniku
        for (const [sId, data] of saradniciMap.entries()) {
            sendGrupniDezurstvoEmail(data.email, data.imePrezime, data.dezurstva);
        }
        await logAction(
            req.user?.username || 'Korisnik',
            'PUBLISH',
            'Raspored',
            `Objavljen raspored sa ${result.count} ispita i poslata obaveštenja saradnicima`
        );
        res.status(200).json({ message: `Uspešno objavljeno ${result.count} ispita i poslata zbirna obaveštenja!` });
    } catch (err) {
        console.error('Greška pri objavljivanju:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
// Dohvata redovnu nastavu sa IMI-ja za blokiranje kalendara
const getZauzetiTermini = async (req, res) => {
    try {
        const { sala_id } = req.query;
        const whereClause = sala_id ? { sala_id: Number(sala_id) } : {};

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
        // 1. Ukupan broj zakazanih ispita
        const totalIspiti = await prisma.ispit.count();

        // 2. Ukupan broj aktivnih saradnika
        const totalSaradnici = await prisma.profesor.count();

        // 3. Traženje najopterećenijeg dežurnog
        const profesori = await prisma.profesor.findMany({
            include: { dezurstva: true }
        });
        
        let topDezurni = '-';
        let maxDezurstava = 0;
        
       profesori.forEach(prof => {
            if (prof.dezurstva.length > maxDezurstava) {
                maxDezurstava = prof.dezurstva.length;
                // Ispisuje puno ime i prezime, npr. "Vuksa Vuksanović (8)"
                const punoIme = `${prof.ime || ''} ${prof.prezime || ''}`.trim();
                topDezurni = `${punoIme} (${maxDezurstava})`;
            }
        });

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
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit,
    saveBulkIspiti,
    publishAll,
    getZauzetiTermini,
    getDashboardStats

};