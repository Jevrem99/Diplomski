const userModel = require('../models/userModel');

const registerUser = async (req, res) => {
    const { username, email, password, uloga } = req.body; // <--- Dodata uloga
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    try {
        const newUser = await userModel.registerUser(username, email, password, uloga); // <--- Prosleđena uloga
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateUser = async (req, res) => {
    const { username, email, password, uloga } = req.body; // <--- Dodata uloga
    try {
        const updatedUser = await userModel.updateUser(req.params.id, username, email, password, uloga); // <--- Prosleđena uloga
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await userModel.getAllUsers();
        res.status(200).json(users);
    }    
    catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const getUserById = async (req, res) => {
    try {
        const user = await userModel.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
const deleteUser = async (req, res) => {
    try {
        const deletedUser = await userModel.deleteUser(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
const getRoles = async (req, res) => {
    // Jedan izvor istine na beku
    const uloge = [
        { id: 'admin', naziv: 'Administrator' },
        { id: 'profesor', naziv: 'Profesor' },
        { id: 'asistent', naziv: 'Asistent / Saradnik' }
    ];
    res.status(200).json(uloge);
};
const changePassword = async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;

    try {
        // 1. Proveravamo da li je stara lozinka tačna
        const isValid = await userModel.validatePassword(username, oldPassword);
        if (!isValid) {
            return res.status(400).json({ error: 'Trenutna lozinka nije tačna!' });
        }

        // 2. Nalazimo korisnika i ažuriramo mu lozinku
        const user = await userModel.getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'Korisnik nije pronađen!' });
        }

        // Koristimo postojeću updateUser funkciju koja će automatski heširati novu lozinku
        await userModel.updateUser(user.id, user.username, user.email, newPassword, user.uloga);

        res.status(200).json({ message: 'Lozinka uspešno promenjena!' });
    } catch (error) {
        console.error('Greška pri promeni lozinke:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
module.exports = {
    registerUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getRoles,
    changePassword
}
