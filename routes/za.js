const express = require('express');
const router = express.Router();
const zaController = require('../controllers/zaController');
const { protect } = require('../middleware/auth');

router.get('/bounties', protect, zaController.getBounties);
router.get('/bounties/:id', protect, zaController.getBountyById);
router.get('/reputation/:userId', protect, zaController.getReputation);

module.exports = router;