const express = require('express');
const adminController = require('../controllers/adminController');
const { protect, restrictToAdmin } = require('../middlewares/authMiddleware');
const auditService = require('../services/auditService'); // Uvoz celog servisa

const router = express.Router();

router.post('/reset-database', protect, restrictToAdmin, adminController.resetDatabase);
router.post('/insert-test-data', protect, restrictToAdmin, adminController.insertTestData);
router.post('/sync-imi', protect, restrictToAdmin, adminController.runImiSync);

// Pregled dnevnika rada
router.get('/logs', protect, restrictToAdmin, async (req, res) => {
    try {
        const logs = await auditService.getRecentLogs(100);
        res.status(200).json(logs);
    } catch (err) {
        console.error('GREŠKA U /admin/logs:', err);
        res.status(500).json({ 
            message: 'Greška pri dohvatanju dnevnika rada', 
            error: err.message 
        });
    }
});

module.exports = router;