const authService = require('../services/authService');
const userModel = require('../models/userModel');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const loginUser = async (req, res) => {
    const { username, password } = req.body;
    try {
        const token = await authService.login(username, password);
        return res.status(200).json({ token });
    } catch (error) {
        console.error('Login error:', error.message);
        if (error.message === 'Invalid username or password') {
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

    try {
        const user = await userModel.getUserByUsername(email.trim().toLowerCase());
        
        // Zbog bezbednosti uvek vraćamo 200 poruku
        if (!user) {
            return res.status(200).json({ message: 'Ako email postoji, link za resetovanje je poslat.' });
        }

        // Generišemo siguran heksadecimalni token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minuta

        await userModel.setResetToken(user.email, resetToken, expiresAt);

        const resetUrl = `http://localhost:4200/login?resetToken=${resetToken}`;

        const mailOptions = {
            from: `"Sistem za Raspored Ispita" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Resetovanje lozinke - Raspored Ispita',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 500px; margin: auto;">
                    <h2 style="color: #34b9f7;">Zahtev za novu lozinku</h2>
                    <p>Poštovani, primili smo zahtev za resetovanje lozinke za korisnički nalog: <strong>${user.username}</strong>.</p>
                    <p>Kliknite na dugme ispod kako biste postavili novu lozinku (link važi 15 minuta):</p>
                    <div style="margin: 25px 0;">
                        <a href="${resetUrl}" style="background-color: #34b9f7; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 10px; display: inline-block;">Postavi novu lozinku</a>
                    </div>
                    <p style="font-size: 12px; color: #64748b;">Ako niste poslali ovaj zahtev, možete bezbedno ignorisati ovaj mejl.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'Ako email postoji, link za resetovanje je poslat.' });
    } catch (error) {
        console.error('Greška u forgotPassword:', error);
        return res.status(500).json({ error: 'Greška pri slanju emaila.' });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token i nova lozinka su obavezni.' });
    }

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

module.exports = {
    loginUser,
    forgotPassword,
    resetPassword
};