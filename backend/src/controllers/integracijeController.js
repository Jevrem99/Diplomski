const { ucitajObjavljeneRezervacije, jeDatum } = require('../services/rezervacijeSala');

// GET /integracije/rezervacije-sala?od=GGGG-MM-DD&do=GGGG-MM-DD
// Snimak trenutnog stanja svih OBJAVLJENIH kolokvijuma u periodu (podrazumevano od danas nadalje).
// Oblik odgovora opisuje docs/rezervacije-sala.schema.json
const getRezervacijeSala = async (req, res) => {
    const { od, do: doDatuma } = req.query;
    if (od !== undefined && !jeDatum(od)) return res.status(400).json({ error: 'Parametar "od" mora biti datum u obliku GGGG-MM-DD.' });
    if (doDatuma !== undefined && !jeDatum(doDatuma)) return res.status(400).json({ error: 'Parametar "do" mora biti datum u obliku GGGG-MM-DD.' });
    if (od !== undefined && doDatuma !== undefined && doDatuma < od) return res.status(400).json({ error: 'Datum "do" ne sme biti pre datuma "od".' });
    try {
        const danas = new Date().toISOString().substring(0, 10);
        const rezultat = await ucitajObjavljeneRezervacije({ od: od ?? danas, doDatuma: doDatuma ?? null, objavio: 'integracija' });
        res.set('Cache-Control', 'no-store');
        res.status(200).json(rezultat);
    } catch (err) {
        console.error('Greška u integraciji (rezervacije sala):', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

module.exports = { getRezervacijeSala };
