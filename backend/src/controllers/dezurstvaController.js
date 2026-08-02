const dezurstvaModel = require('../models/dezurstvaModel');

const getMojaDezurstva = async (req, res) => {
    const { saradnik_id } = req.params;
    try {
        const dezurstva = await dezurstvaModel.getDezurstvaBySaradnikId(saradnik_id);
        res.status(200).json(dezurstva);
    } catch (error) {
        console.error('Greška pri dohvatanju dežurstava:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { getMojaDezurstva };