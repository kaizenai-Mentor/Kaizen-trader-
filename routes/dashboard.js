const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const sessionsController = require('../controllers/sessionsController');
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

// ── V2 SESSIONS (core loop): plan → record → reflect → detail ──
router.get('/sessions', protect, sessionsController.getSessions);
router.get('/sessions/new', protect, sessionsController.getPlan);
router.post('/sessions/plan', protect, sessionsController.postPlan);
router.get('/sessions/:id/record', protect, sessionsController.getRecord);
router.post('/sessions/:id/record', protect, upload.single('chartImage'), sessionsController.postRecord);
router.get('/sessions/:id/reflect', protect, sessionsController.getReflect);
router.post('/sessions/:id/reflect', protect, sessionsController.postReflect);
router.get('/sessions/:id', protect, sessionsController.getDetail);

// Legacy journal: form handler kept working; the page redirects to Sessions
router.post('/journal', protect, upload.single('chartImage'), dashboardController.addJournal);
router.get('/journal', protect, (req, res) => res.redirect('/dashboard/sessions'));

router.get('/chart', protect, (req, res) => {
  res.redirect('/chart');
});

module.exports = router;
