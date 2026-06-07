const userModel = require('../models/userModel');

const login = async (username, password) => {
    
    const isValid = await userModel.validatePassword(username, password);

    if (!isValid) {
        throw new Error('Invalid username or password');
    };

    const user = await userModel.getUserByUsername(username);

    return userModel.generateJwtToken(user);
}

module.exports = {
    login
}