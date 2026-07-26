
const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');


const getAllUsers = async () => {
    const result = await pool.query('SELECT id, username, email FROM "User"');
    return result.rows;
}

const getUserById = async (id) => {
    const result = await pool.query('SELECT id, username, email, password FROM "User" WHERE id = $1', [id]);
    return result.rows[0];
}

const getUserByUsername = async (username) => {
    const result = await pool.query('SELECT id, username, email FROM "User" WHERE username = $1', [username]);
    return result.rows[0];
}

const registerUser = async (username, email, password) => {

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            'INSERT INTO "User" (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email', 
            [username, email, hashedPassword]
        );

        return result.rows[0];
}

const updateUser = async (id, username, email, password) => {

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
        'UPDATE "User" SET username = $1, email = $2, password = $3 WHERE id = $4 RETURNING id, username, email', 
        [username, email, hashedPassword, id]
    );
    return result.rows[0];
}

const deleteUser = async (id) => {
    const result = await pool.query('DELETE FROM "User" WHERE id = $1 RETURNING id, username, email', [id]);
    return result.rows[0];
}

const validatePassword = async (username, password) => {

    const result = await pool.query('SELECT password FROM "User" WHERE username = $1', [username]);

    const hashedPassword = result.rows.length > 0 
        ? result.rows[0].password 
        : "$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashf";

    const isValid = await bcrypt.compare(password, hashedPassword);

    if (result.rows.length === 0) {
        return false;
    }

    return isValid;
}

const generateJwtToken = (user) => {

    var expire = new Date();
    expire.setDate(expire.getDate() + 7);

    return jwt.sign({
        id: user.id,
        username: user.username,
        email: user.email,
        exp: parseInt(expire.getTime() / 1000),
    }, config.secret)
}

module.exports = {
    getAllUsers,
    getUserById,
    getUserByUsername,
    registerUser,
    updateUser,
    deleteUser,
    validatePassword,
    generateJwtToken
}