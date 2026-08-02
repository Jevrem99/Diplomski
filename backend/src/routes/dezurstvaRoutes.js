const express = require('express');
const dezurstvaController = require('../controllers/dezurstvaController');
const router = express.Router();

router.get('/saradnik/:saradnik_id', dezurstvaController.getMojaDezurstva);

module.exports = router;