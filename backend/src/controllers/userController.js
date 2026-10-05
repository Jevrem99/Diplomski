const { logAction } = require('../services/auditService');
const userModel = require('../models/userModel');
const prisma = require('../db/prisma');
const { proveriLozinku, validirajKorisnika, odbaciAkoImaGresaka, mapirajPrismaGresku } = require('../utils/validators');

// Proverava da li su korisničko ime / e-mail zauzeti (bez obzira na velika i mala slova)
const nadjiZauzeta = async (username, email, izuzetiId = null) => {
    const zauzeti = await prisma.user.findMany({
        where: {
            ...(izuzetiId ? { id: { not: Number(izuzetiId) } } : {}),
            OR: [
                { username: { equals: String(username).trim(), mode: 'insensitive' } },
                { email: { equals: String(email).trim(), mode: 'insensitive' } }
            ]
        }
    });
    const polja = {};
    zauzeti.forEach((u) => {
        if (u.username.toLowerCase() === String(username).trim().toLowerCase()) polja.username = 'Korisničko ime je već zauzeto.';
        if (u.email.toLowerCase() === String(email).trim().toLowerCase()) polja.email = 'Ovaj e-mail već ima nalog.';
    });
    return polja;
};

const registerUser = async (req, res) => {
    const { username, email, password, uloga } = req.body;

    if (odbaciAkoImaGresaka(res, validirajKorisnika(req.body, { lozinkaObavezna: true }))) return;
    try {
        const zauzeta = await nadjiZauzeta(username, email);
        if (Object.keys(zauzeta).length > 0) {
            return res.status(409).json({ error: 'Nalog sa ovim podacima već postoji.', polja: zauzeta });
        }

        const newUser = await userModel.registerUser(String(username).trim(), String(email).trim().toLowerCase(), password, uloga);
        await logAction(req.user?.username || 'Korisnik', 'CREATE', 'Korisnik', `Napravljen nalog "${newUser.username}" (${newUser.uloga})`);
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error registering user:', error);
        if (mapirajPrismaGresku(error, res)) return;
        res.status(500).json({ error: 'Greška na serveru pri pravljenju naloga.' });
    }
};

const updateUser = async (req, res) => {
    const { username, email, password, uloga } = req.body;

    if (odbaciAkoImaGresaka(res, validirajKorisnika(req.body, { lozinkaObavezna: false }))) return;
    try {
        const zauzeta = await nadjiZauzeta(username, email, req.params.id);
        if (Object.keys(zauzeta).length > 0) {
            return res.status(409).json({ error: 'Nalog sa ovim podacima već postoji.', polja: zauzeta });
        }

        // Admin ne sme sam sebi da oduzme administratorsku ulogu (ne bi mogao da je vrati)
        if (Number(req.params.id) === req.user.id && uloga && uloga !== 'admin') {
            return res.status(400).json({ error: 'Ne možete sebi oduzeti administratorsku ulogu.', polja: { uloga: 'Ne možete promeniti sopstvenu ulogu.' } });
        }

        const updatedUser = await userModel.updateUser(req.params.id, String(username).trim(), String(email).trim().toLowerCase(), password, uloga);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        await logAction(req.user?.username || 'Korisnik', 'UPDATE', 'Korisnik', `Izmenjen nalog "${updatedUser.username}" (${updatedUser.uloga})`);
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        if (mapirajPrismaGresku(error, res)) return;
        res.status(500).json({ error: 'Greška na serveru pri izmeni naloga.' });
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
    if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'Ne možete obrisati sopstveni nalog.' });
    }
    try {
        const deletedUser = await userModel.deleteUser(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        await logAction(req.user?.username || 'Korisnik', 'DELETE', 'Korisnik', `Obrisan nalog "${deletedUser.username}"`);
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
    const { oldPassword, newPassword } = req.body;
    // Lozinku menja samo prijavljeni korisnik sebi (identitet dolazi iz tokena, ne iz tela zahteva)
    const username = req.user.username;

    const greskaLozinke = proveriLozinku(newPassword);
    if (greskaLozinke) return res.status(400).json({ error: greskaLozinke });

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

        await logAction(req.user?.username || 'Korisnik', 'PASSWORD', 'Korisnik', 'Promenjena sopstvena lozinka');
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
