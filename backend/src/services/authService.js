const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');

const login = async (username, password) => {
    // Jedan upit u bazu: korisnik se traži jednom, pa se na njemu proverava lozinka
    const user = typeof username === 'string' && typeof password === 'string'
        ? await userModel.getUserByUsername(username)
        : null;

    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error('Invalid username or password');
    }

    return userModel.generateJwtToken(user);
};

module.exports = {
    login
};
