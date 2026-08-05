const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendGrupniDezurstvoEmail = async (asistentEmail, asistentIme, dezurstvaNiz) => {
    try {
        const redoviTabele = dezurstvaNiz.map(d => `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background-color: ${d.isIzmenjen ? '#fff5f5' : '#ffffff'};">
                    <strong>${d.predmet}</strong>
                    ${d.isIzmenjen ? '<br><span style="color: #dc2626; font-size: 12px; font-weight: bold;">Izmena rasporeda</span>' : ''}
                </td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; background-color: ${d.isIzmenjen ? '#fff5f5' : '#ffffff'};">${d.datum}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; background-color: ${d.isIzmenjen ? '#fff5f5' : '#ffffff'};">${d.vreme}${d.vremeKraja ? ' - ' + d.vremeKraja : ''}h</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; background-color: ${d.isIzmenjen ? '#fff5f5' : '#ffffff'};">${d.sala}</td>
            </tr>
        `).join('');

        const mailOptions = {
            from: `"Sistem za Raspored Ispita" <${process.env.EMAIL_USER}>`,
            to: asistentEmail,
            subject: `Raspored dežurstava - Ažurirano`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 650px; margin: auto;">
                    <h2 style="color: #34b9f7; margin-top: 0;">Pregled dežurstava</h2>
                    <p>Poštovani/a <strong>${asistentIme}</strong>,</p>
                    <p>U nastavku je pregled Vaših zaduženja. Termini koji su naknadno menjani označeni su crvenim slovima:</p>
                    
                    <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
                        <thead>
                            <tr style="background-color: #f8fafc;">
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Predmet</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Datum</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Vreme</th>
                                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Sala</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${redoviTabele}
                        </tbody>
                    </table>
                    
                    <p style="margin-top: 25px; font-size: 14px; color: #555;">
                        Sve obaveze možeš pratiti na <a href="http://localhost:4200" style="color: #34b9f7;">Korisničkom portalu</a>.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error(`Greška pri slanju mejla za ${asistentEmail}:`, error);
        return false;
    }
};

const sendIzmenaDezurstvaEmail = async (asistentEmail, asistentIme, predmetNaziv, datum, vreme, vremeKraja, salaNaziv) => {
    try {
        const mailOptions = {
            from: `"Sistem za Raspored Ispita" <${process.env.EMAIL_USER}>`,
            to: asistentEmail,
            subject: `Izmena rasporeda: ${predmetNaziv}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #ef4444;">Izmena dežurstva</h2>
                    <p>Poštovani/a <strong>${asistentIme}</strong>,</p>
                    <p>Došlo je do izmene termina za dežurstvo:</p>
                    <table style="border-collapse: collapse; width: 100%; max-width: 400px; margin-top: 15px;">
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8fafc;"><strong>Predmet:</strong></td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${predmetNaziv}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8fafc;"><strong>Datum:</strong></td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${datum}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8fafc;"><strong>Vreme:</strong></td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${vreme}${vremeKraja ? ' - ' + vremeKraja : ''}h</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd; background-color: #f8fafc;"><strong>Sala:</strong></td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${salaNaziv}</td>
                        </tr>
                    </table>
                    <p style="margin-top: 20px;">Detalje možeš pogledati na <a href="http://localhost:4200" style="color: #34b9f7;">portalu</a>.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error(`Greška pri slanju emaila o izmeni za ${asistentEmail}:`, error);
        return false;
    }
};

module.exports = { sendGrupniDezurstvoEmail, sendIzmenaDezurstvaEmail };