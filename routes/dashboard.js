const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Images only'));
  }
});

router.get('/', protect, dashboardController.getDashboard);
router.post('/journal', protect, upload.single('chartImage'), dashboardController.addJournal);
router.get('/journal', protect, dashboardController.getJournals);
router.get('/chart', protect, (req, res) => {
  res.redirect('/chart');
});

module.exports = router;
