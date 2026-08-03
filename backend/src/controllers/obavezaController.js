const obavezaModel = require('../models/obavezaModel');

const getObaveze = async (req, res) => {
  try {
    const { saradnik_id } = req.params;
    
    // Ako stigne saradnik_id prosleđujemo ga, ako ne stigne prosleđujemo undefined
    const obaveze = await obavezaModel.getObavezeBySaradnikId(saradnik_id);
    
    res.json(obaveze);
  } catch (error) {
    console.error('Greška pri dohvatanju obaveza:', error);
    res.status(500).json({ message: 'Greška na serveru pri dohvatanju obaveza.' });
  }
};

const createObaveza = async (req, res) => {
    const { saradnik_id, datum, datum_do, vreme_pocetka, vreme_kraja, tip_obaveze } = req.body;
    try {
        const novaObaveza = await obavezaModel.createObaveza(saradnik_id, datum, datum_do, vreme_pocetka, vreme_kraja, tip_obaveze);
        res.status(201).json(novaObaveza);
    } catch (error) {
        console.error('Greška pri dodavanju obaveze:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteObaveza = async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await obavezaModel.deleteObaveza(id);
        res.status(200).json(deleted);
    } catch (error) {
        console.error('Greška pri brisanju obaveze:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getObaveze,
    createObaveza,
    deleteObaveza
};