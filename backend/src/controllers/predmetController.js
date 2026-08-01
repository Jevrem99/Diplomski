const predmetModel = require('../models/predmetModel');

const getAllPredmets = async (req, res) => {
    try {
        const predmets = await predmetModel.getAllPredmets();
        res.status(200).json(predmets);
    } catch (err) {
        console.error('Error fetching predmets:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const getPredmetById = async (req, res) => {
    const { id } = req.params;
    try {
        const predmet = await predmetModel.getPredmetById(id);
        if (!predmet) {
            return res.status(404).json({ error: 'Predmet not found' });
        }
        res.status(200).json(predmet);
    } catch (err) {
        console.error(`Error fetching predmet with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const createPredmet = async (req, res) => {
    const { sifra, naziv, godina, semestar, status, broj_studenata, profesor_id, saradnici_ids } = req.body;
    try {
        const newPredmet = await predmetModel.createPredmet(
            sifra, naziv, godina, semestar, status, broj_studenata, profesor_id, saradnici_ids
        );
        res.status(201).json(newPredmet);
    } catch (err) {
        console.error('Error creating predmet:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updatePredmet = async (req, res) => {
    const { id } = req.params;
    const { sifra, naziv, godina, semestar, status, broj_studenata, profesor_id, saradnici_ids } = req.body;
    try {
        const updatedPredmet = await predmetModel.updatePredmet(
            id, sifra, naziv, godina, semestar, status, broj_studenata, profesor_id, saradnici_ids
        );
        if (!updatedPredmet) return res.status(404).json({ error: 'Predmet not found' });
        res.status(200).json(updatedPredmet);
    } catch (err) {
        console.error(`Error updating predmet ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deletePredmet = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedPredmet = await predmetModel.deletePredmet(id);
        if (!deletedPredmet) {
            return res.status(404).json({ error: 'Predmet not found' });
        }
        res.status(200).json(deletedPredmet);
    } catch (err) {
        console.error(`Error deleting predmet with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    getAllPredmets,
    getPredmetById,
    createPredmet,
    updatePredmet,
    deletePredmet
};