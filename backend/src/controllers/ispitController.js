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

    try {
        const newIspit = await ispitModel.createIspit(
            predmet_id, 
            finalDatum, 
            finalVreme, 
            is_ispit ?? true, 
            finalSala
        );
        res.status(201).json(newIspit);
    } catch (err) {
        console.error('Error creating ispit:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateIspit = async (req, res) => {
    const { id } = req.params;
    const { predmet_id, datum, vreme, is_ispit, sala } = req.body;
    try {
        const updatedIspit = await ispitModel.updateIspit(id, predmet_id, datum, vreme, is_ispit, sala);
        if (!updatedIspit) return res.status(404).json({ error: 'Ispit not found' });
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
    try {
        const ispitiNiz = req.body;
        const sacuvaniIspiti = await Promise.all(
            ispitiNiz.map(async (ispit) => {
                return await prisma.ispit.create({
                    data: {
                        predmet_id: parseInt(ispit.predmet_id),
                        datum: new Date(ispit.datum),
                        vreme: new Date(`1970-01-01T${ispit.vreme}`),
                        is_ispit: true
                    }
                });
            })
        );

        res.status(201).json({ message: 'Uspešno sačuvan raspored!', sacuvaniIspiti });
    } catch (error) {
        console.error('Greška pri bulk snimanju ispita:', error);
        res.status(500).json({ error: 'Greška na serveru pri čuvanju rasporeda.' });
    }
};
module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit,
    saveBulkIspiti
};