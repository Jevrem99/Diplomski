const ispitModel = require('../models/ispitModel');
const prisma = require('../db/prisma');
const { sendGrupniDezurstvoEmail, sendIzmenaDezurstvaEmail } = require('../services/emailService'); // <--- DODAJ OVDE
const { logAction } = require('../services/auditService');
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
    const { predmet_id, datum, vreme, is_ispit, sala, date, startTime, room, vreme_kraja, endTime, dezurni_ids } = req.body;
    
    const finalDatum = datum || date;
    const finalVreme = vreme || startTime;
    const finalSala = sala || room;
    const finalVremeKraja = vreme_kraja || endTime;

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
    const { predmet_id, datum, vreme, vreme_kraja, is_ispit, sala, room, dezurni_ids } = req.body;
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