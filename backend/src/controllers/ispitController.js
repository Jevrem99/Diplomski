const ispitModel = require('../models/ispitModel');
const prisma = require('../db/prisma');
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

const createIspit = async (req, res) => {
    // Front šalje: { predmet_id (ili title ako tražimo ID), date, startTime, room }
    const { predmet_id, datum, vreme, is_ispit, sala, date, startTime, room } = req.body;

    // Fallback ako sa fronta stigne nova struktura iz modala
    const finalDatum = datum || date;
    const finalVreme = vreme || startTime;
    const finalSala = sala || room;
    const finalVremeKraja = vreme_kraja || endTime;
    try {
        const newIspit = await ispitModel.createIspit(predmet_id, finalDatum, finalVreme, finalVremeKraja, is_ispit ?? true, finalSala);
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

        // Proveravamo da li je izabranaSala objekat ili tekst
        const salaNaziv = typeof izabranaSala === 'object' && izabranaSala !== null 
            ? izabranaSala.naziv 
            : izabranaSala;

        // Nalaženje ili kreiranje sale po nazivu
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

        const updatedIspit = await ispitModel.updateIspit(
            id, 
            predmet_id, 
            datum, 
            vreme, 
            vreme_kraja, 
            is_ispit, 
            salaId, 
            dezurni_ids || []
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
            sacuvaniIspiti.push(newIspit);
        }

        res.status(201).json(sacuvaniIspiti);
    } catch (err) {
        console.error('Error in bulk save:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
const publishAll = async (req, res) => {
    try {
        // Prebacujemo sve ispite iz statusa nacrta u objavljeno
        const result = await prisma.ispit.updateMany({
            where: { is_published: false },
            data: { is_published: true }
        });
        res.status(200).json({ message: `Uspešno objavljeno ${result.count} ispita!` });
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
module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit,
    saveBulkIspiti,
    publishAll,
    getZauzetiTermini
};