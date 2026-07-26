const pool = require('../db/connection');
const config = require('../config/config');

const getAllProfesors = async () => {
    const result = await pool.query('SELECT id, ime, prezime, is_saradnik, email FROM Profesor');
    return result.rows;
}

const getProfesorById = async (id) => {
    const result = await pool.query('SELECT id, ime, prezime, is_saradnik, email FROM Profesor WHERE id = $1', [id]);
    return result.rows[0];
}

//is_saradnik mozda nepotreban ako se na frotnu dodavanje profesora i saradnika odvaja
const createProfesor = async (ime, prezime, is_saradnik, email) => {
    const result = await pool.query(
        'INSERT INTO Profesor (ime, prezime, is_saradnik, email) VALUES ($1, $2, $3, $4) RETURNING id, ime, prezime, is_saradnik, email', 
        [ime, prezime, is_saradnik, email]
    );
    return result.rows[0];
}

//is_saradnik mozda nepotreban ako se na frotnu dodavanje profesora i saradnika odvaja
const updateProfesor = async (id, ime, prezime, is_saradnik, email) => {
    const result = await pool.query(
        'UPDATE Profesor SET ime = $1, prezime = $2, is_saradnik = $3, email = $4 WHERE id = $5 RETURNING id, ime, prezime, is_saradnik, email',
        [ime, prezime, is_saradnik, email, id]
    );
    return result.rows[0];
}

const deleteProfesor = async (id) => {
    const result = await pool.query('DELETE FROM Profesor WHERE id = $1 RETURNING id, ime, prezime, is_saradnik, email', [id]);
    return result.rows[0];
}

module.exports = {
    getAllProfesors,
    getProfesorById,
    createProfesor,
    updateProfesor,
    deleteProfesor
};