const pool = require('../db/connection');
const config = require('../config/config');

const getAllIspiti = async () => {
    const result = await pool.query('SELECT id, predmet_id, datum, vreme, is_ispit FROM Ispit');
    return result.rows;
}

const getIspitById = async (id) => {
    const result = await pool.query('SELECT id, predmet_id, datum, vreme, is_ispit FROM Ispit WHERE id = $1', [id]);
    return result.rows[0];
}

const createIspit = async (predmet_id, datum, vreme, is_ispit) => {
    const result = await pool.query(
        'INSERT INTO Ispit (predmet_id, datum, vreme, is_ispit) VALUES ($1, $2, $3, $4) RETURNING id, predmet_id, datum, vreme, is_ispit',
        [predmet_id, datum, vreme, is_ispit]
    );
    return result.rows[0];
}

const updateIspit = async (id, predmet_id, datum, vreme, is_ispit) => {
    const result = await pool.query(
        'UPDATE Ispit SET predmet_id = $1, datum = $2, vreme = $3, is_ispit = $4 WHERE id = $5 RETURNING id, predmet_id, datum, vreme, is_ispit',
        [predmet_id, datum, vreme, is_ispit, id]
    );
    return result.rows[0];
}

const deleteIspit = async (id) => {
    const result = await pool.query('DELETE FROM Ispit WHERE id = $1 RETURNING id, predmet_id, datum, vreme, is_ispit', [id]);
    return result.rows[0];
}

module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit
};