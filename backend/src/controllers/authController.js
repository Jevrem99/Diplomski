const { logAction } = require('../services/auditService');
const authService = require('../services/authService');
const userModel = require('../models/userModel');
const crypto = require('crypto');
const config = require('../config/config');
const { jeValidnaUloga, proveriLozinku, proveriEmail } = require('../utils/validators');
const { sendResetLozinkeEmail } = require('../services/emailService');

const loginUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const token = await authService.login(username, password);
        await logAction(username, 'LOGIN', 'Sesija', 'Uspešna prijava');
        return res.status(200).json({ token });
    } catch (error) {
        console.error('Login error:', error.message);
        if (error.message === 'Invalid username or password') {
            await logAction(String(username || '?').slice(0, 60), 'LOGIN_FAILED', 'Sesija', 'Neuspešna prijava');
            return res.status(401).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email je obavezno polje.' });
    }
    const greskaEmaila = proveriEmail(email);
    if (greskaEmaila) return res.status(400).json({ error: greskaEmaila, polja: { email: greskaEmaila } });

    // Odgovor ide ODMAH i uvek je isti, bez obzira da li nalog postoji: korisnik ne čeka slanje mejla,
    // a po brzini odgovora se ne može saznati koji e-mail adrese postoje u sistemu.
    res.status(200).json({ message: 'Ako email postoji, link za resetovanje je poslat.' });

    try {
        const user = await userModel.getUserByUsername(email.trim().toLowerCase());
        if (!user) return;

        // Generišemo siguran heksadecimalni token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minuta
        await userModel.setResetToken(user.email, resetToken, expiresAt);

        const resetUrl = `${config.frontendUrl}/login?resetToken=${resetToken}`;
        await sendResetLozinkeEmail(user.email, user.username, resetUrl);
    } catch (error) {
        console.error('Greška u forgotPassword:', error);
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token i nova lozinka su obavezni.' });
    }
    const greskaLozinke = proveriLozinku(newPassword);
    if (greskaLozinke) return res.status(400).json({ error: greskaLozinke });

    try {
        const user = await userModel.getUserByResetToken(token);
        if (!user) {
            return res.status(400).json({ error: 'Link za resetovanje je istekao ili je nevažeći.' });
        }

        // Ažuriramo lozinku i brišemo iskorišćeni token
        const updatedUser = await userModel.updatePasswordByReset(user.id, newPassword);

        // Automatski generišemo JWT token za direktnu prijavu
        const jwtToken = userModel.generateJwtToken(updatedUser);

        return res.status(200).json({ 
            message: 'Lozinka uspešno promenjena!',
            token: jwtToken 
        });
    } catch (error) {
        console.error('Greška u resetPassword:', error);
        return res.status(500).json({ error: 'Interna greška servera.' });
    }
};

const adminResetPassword = async (req, res) => {
    const { email, newPassword, role, username } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email i nova lozinka su obavezni.' });
    }
    const greskaEmaila = proveriEmail(email);
    if (greskaEmaila) return res.status(400).json({ error: greskaEmaila, polja: { email: greskaEmaila } });
    const greskaLozinke = proveriLozinku(newPassword);
    if (greskaLozinke) return res.status(400).json({ error: greskaLozinke });
    if (role && !jeValidnaUloga(role)) return res.status(400).json({ error: 'Nevalidna uloga.' });

    const cleanEmail = email.trim().toLowerCase();
    // Ako username nije posebno prosleđen sa frontenda, koristimo email kao username
    const userUsername = username || cleanEmail;

    try {
        // 1. Proveravamo da li korisnik već postoji
        const existingUser = await userModel.getUserByUsername(cleanEmail);

        if (!existingUser) {
            // 2. Prosleđujemo 4 argumenta tačno onim redom kako očekuje registerUser:
            // (username, email, password, uloga)
            await userModel.registerUser(
                userUsername,
                cleanEmail,
                newPassword,
                role || 'asistent'
            );

            await logAction(req.user?.username || 'Korisnik', 'CREATE', 'Korisnik', `Napravljen nalog za ${cleanEmail} (admin)`);
            return res.status(201).json({ 
                message: `Korisnički nalog za ${cleanEmail} je uspešno kreiran i lozinka je postavljena!` 
            });
        }

        // 3. Ako nalog već postoji, samo mu ažuriramo lozinku
        await userModel.resetPasswordWithEmail(existingUser.email, newPassword);

        await logAction(req.user?.username || 'Korisnik', 'PASSWORD', 'Korisnik', `Admin je resetovao lozinku za ${cleanEmail}`);
        return res.status(200).json({ 
            message: `Lozinka za ${cleanEmail} je uspešno izmenjena!` 
        });

    } catch (error) {
        console.error('Greška u adminResetPassword:', error);
        return res.status(500).json({ error: 'Interna greška servera pri obradi naloga.' });
    }
};

module.exports = {
    loginUser,
    forgotPassword,
    resetPassword,
    adminResetPassword
};