const express = require('express');
const router = express.Router();
const chartController = require('../controllers/chartController');
const { protect } = require('../middleware/auth');

router.get('/', protect, chartController.getChart);
router.get('/data', protect, chartController.getChartData);
router.post('/drawings/save', protect, chartController.saveDrawings);
router.get('/drawings/load', protect, chartController.loadDrawings);

module.exports = router;
