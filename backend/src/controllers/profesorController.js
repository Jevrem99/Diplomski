const profesorModel = require('../models/profesorModel');
const prisma = require('../db/prisma'); // <--- DODAJ OVU LINIJU NA SAM VRH FAJLA
const getAllPredavaci = async (req, res) => {
    try {
        const predavaci = await profesorModel.getAllPredavaci();
        res.status(200).json(predavaci);
    } catch (err) {
        console.error('Error fetching predavaci:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const getAllProfesori = async (req, res) => {
    try {
        const profesors = await profesorModel.getAllProfesori();
        res.status(200).json(profesors);
    } catch (err) {
        console.error('Error fetching profesors:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const getAllSaradnici = async (req, res) => {
    try {
        const saradnici = await prisma.profesor.findMany({
            where: { is_saradnik: true },
            include: {
                obaveze: true,
                dezurstva: {
                    include: { ispit: true }
                }
            }
        });
        res.status(200).json(saradnici);
    } catch (err) {
        console.error('Error fetching saradnici:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

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
    const { ime, prezime, email,is_saradnik } = req.body;
    try {
        const newProfesor = await profesorModel.createProfesor(ime, prezime, email,is_saradnik);
        res.status(201).json(newProfesor);
    } catch (err) {
        console.error('Error creating profesor:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const updateProfesor = async (req, res) => {
    const { id } = req.params;
    const { ime, prezime, email , is_saradnik } = req.body;
    try {
        const updatedProfesor = await profesorModel.updateProfesor(id, ime, prezime, email,is_saradnik);
        if (!updatedProfesor) {
            return res.status(404).json({ error: 'Profesor not found' });
        }
        res.status(200).json(updatedProfesor);
    } catch (err) {
        console.error(`Error updating profesor with id ${id}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
const createSaradnik = async (req, res) => {
    const { ime, prezime, email } = req.body;
    try {
        // Saradnik (asistent)
        const newSaradnik = await profesorModel.createProfesor(ime, prezime, email, true);
        res.status(201).json(newSaradnik);
    } catch (err) {
        console.error('Error creating saradnik:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
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
    getAllPredavaci,
    getAllSaradnici,
    getAllProfesori,
    getProfesorById,
    createProfesor,
    updateProfesor,
    deleteProfesor
};