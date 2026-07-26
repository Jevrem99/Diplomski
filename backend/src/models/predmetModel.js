const pool = require('../db/connection');
const config = require('../config/config');

const getAllPredmets = async () => {
    const result = await pool.query('SELECT id, naziv,godina, semestar, status, sifra, profesor_id FROM Predmet');
    return result.rows;
}

const getPredmetById = async (id) => {
    const result = await pool.query('SELECT id, naziv,godina, semestar, status, sifra, profesor_id FROM Predmet WHERE id = $1', [id]);
    return result.rows[0];
}

// Predmet (id, naziv, godina, semestar, status, sifra, profesor_id)
const createPredmet = async (naziv, godina, semestar, status, sifra, profesor_id) => {
    const result = await pool.query(
        'INSERT INTO Predmet (naziv, godina, semestar, status, sifra, profesor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, naziv, godina, semestar, status, sifra, profesor_id', 
        [naziv, godina, semestar, status, sifra, profesor_id]
    );
    return result.rows[0];
}

const updatePredmet = async (id, naziv, godina, semestar, status, sifra, profesor_id) => {
    const result = await pool.query(
        'UPDATE Predmet SET naziv = $1, godina = $2, semestar = $3, status = $4, sifra = $5, profesor_id = $6 WHERE id = $7 RETURNING id, naziv, godina, semestar, status, sifra, profesor_id',
        [naziv, godina, semestar, status, sifra, profesor_id, id]
    );
    return result.rows[0];
}

const deletePredmet = async (id) => {
    const result = await pool.query('DELETE FROM Predmet WHERE id = $1 RETURNING id, naziv, godina, semestar, status, sifra, profesor_id', [id]);
    return result.rows[0];
}

module.exports = {
    getAllPredmets,
    getPredmetById,
    createPredmet,
    updatePredmet,
    deletePredmet
};