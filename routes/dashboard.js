const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/', protect, dashboardController.getDashboard);
router.post('/journal', protect, dashboardController.addJournal);
router.get('/journal', protect, dashboardController.getJournals);

module.exports = router;