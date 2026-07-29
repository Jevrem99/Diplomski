const ispitModel = require('../models/ispitModel');

const getAllIspiti = async (req, res) => {
    try {
        const ispiti = await ispitModel.getAllIspiti();
        res.status(200).json(ispiti);
    } catch (err) {
        console.error('Error fetching ispiti:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const getIspitById = async (req, res) => {
    const { id } = req.params;
    try {
        const ispit = await ispitModel.getIspitById(id);
        if (!ispit) {
            return res.status(404).json({ error: 'Ispit not found' });
        }
        res.status(200).json(ispit);
    } catch (err) {
        console.error(`Error fetching ispit with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const createIspit = async (req, res) => {
    const { predmet_id, datum, vreme, is_ispit } = req.body;
    try {
        const newIspit = await ispitModel.createIspit(predmet_id, datum, vreme, is_ispit);
        res.status(201).json(newIspit);
    } catch (err) {
        console.error('Error creating ispit:', err);
        res.status(500).json({ error: 'Internal server error' });
    }   
}

const updateIspit = async (req, res) => {
    const { id } = req.params;
    const { predmet_id, datum, vreme, is_ispit } = req.body;
    try {
        const updatedIspit = await ispitModel.updateIspit(id, predmet_id, datum, vreme, is_ispit);
        if (!updatedIspit) {
            return res.status(404).json({ error: 'Ispit not found' });
        }
        res.status(200).json(updatedIspit);
    } catch (err) {
        console.error(`Error updating ispit with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

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

module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit
};