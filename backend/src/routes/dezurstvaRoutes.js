const express = require('express');
const dezurstvaController = require('../controllers/dezurstvaController');
const { protect, restrictToAdmin, ownerOrStaff } = require('../middlewares/authMiddleware');
const router = express.Router();

// Moja dežurstva kao kalendar (.ics) za Google/Outlook/telefon
router.get('/moj-kalendar.ics', protect, dezurstvaController.exportMojKalendar);

router.get('/saradnik/:saradnik_id', protect, ownerOrStaff((req) => req.params.saradnik_id), dezurstvaController.getMojaDezurstva);

// Excel izveštaj: raspored dežurstava (samo admin)
router.get('/export-excel', protect, restrictToAdmin, dezurstvaController.exportRasporedDezurstava);

module.exports = router;
