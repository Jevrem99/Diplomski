const profesorModel = require('../models/profesorMode');

const getAllProfesors = async (req, res) => {
    try {
        const profesors = await profesorModel.getAllProfesors();
        res.status(200).json(profesors);
    } catch (err) {
        console.error('Error fetching profesors:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const getProfesorById = async (req, res) => {
    const { id } = req.params;
    try {
        const profesor = await profesorModel.getProfesorById(id);
        if (!profesor) {
            return res.status(404).json({ error: 'Profesor not found' });
        }
        res.status(200).json(profesor);
    } catch (err) {
        console.error(`Error fetching profesor with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const createProfesor = async (req, res) => {
    const { ime, prezime, is_saradnik, email } = req.body;
    try {
        const newProfesor = await profesorModel.createProfesor(ime, prezime, is_saradnik, email);
        res.status(201).json(newProfesor);
    } catch (err) {
        console.error('Error creating profesor:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const updateProfesor = async (req, res) => {
    const { id } = req.params;
    const { ime, prezime, is_saradnik, email } = req.body;
    try {
        const updatedProfesor = await profesorModel.updateProfesor(id, ime, prezime, is_saradnik, email);
        if (!updatedProfesor) {
            return res.status(404).json({ error: 'Profesor not found' });
        }
        res.status(200).json(updatedProfesor);
    } catch (err) {
        console.error(`Error updating profesor with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const deleteProfesor = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedProfesor = await profesorModel.deleteProfesor(id);
        if (!deletedProfesor) {
            return res.status(404).json({ error: 'Profesor not found' });
        }
        res.status(200).json(deletedProfesor);
    } catch (err) {
        console.error(`Error deleting profesor with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
} 

module.exports = {
    getAllProfesors,
    getProfesorById,
    createProfesor,
    updateProfesor,
    deleteProfesor
};