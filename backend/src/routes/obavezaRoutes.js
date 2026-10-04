const express = require('express');
const obavezaController = require('../controllers/obavezaController');
const prisma = require('../db/prisma');
const { protect, ownerOrStaff } = require('../middlewares/authMiddleware');
const router = express.Router();

const jePrivilegovan = (req) => req.user.uloga === 'admin';

// GET /obaveze (sve obaveze) samo admin; GET /obaveze/:saradnik_id i ostali, ali samo za sebe
router.get('/:saradnik_id?', protect, (req, res, next) => {
    if (!req.params.saradnik_id) {
        if (jePrivilegovan(req)) return next();
        return res.status(403).json({ message: 'Nemate dozvolu za ovu akciju!' });
    }
    return ownerOrStaff((r) => r.params.saradnik_id)(req, res, next);
}, obavezaController.getObaveze);

router.post('/', protect, ownerOrStaff((req) => req.body.saradnik_id), obavezaController.createObaveza);

router.delete('/:id', protect, ownerOrStaff(async (req) => {
    const obaveza = await prisma.obaveza.findUnique({ where: { id: Number(req.params.id) } });
    return obaveza ? obaveza.saradnik_id : null;
}), obavezaController.deleteObaveza);

module.exports = router;
