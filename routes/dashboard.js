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

const uploadReport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// A() — async route wrapper (crash fix, owner directive): a rejected
// controller promise reaches the Express error middleware instead of
// becoming an unhandled rejection (which kills the whole Node process).
// Sync throws are forwarded too — one wrapper, both failure modes.
const A = (fn) => (req, res, next) =>
  Promise.resolve().then(() => fn(req, res, next)).catch(next);

router.get('/', protect, A(dashboardController.getDashboard));
router.post('/cutover-ack', protect, A(dashboardController.ackCutover));

// ── V2 SESSIONS (core loop): plan → record → reflect → detail ──
router.get('/sessions', protect, A(sessionsController.getSessions));
router.post('/sessions/import-broker', protect, uploadReport.single('brokerFile'), A(sessionsController.postImportBroker));
router.get('/sessions/new', protect, A(sessionsController.getPlan));
router.post('/sessions/plan', protect, A(sessionsController.postPlan));
router.get('/sessions/:id/record', protect, A(sessionsController.getRecord));
router.post('/sessions/:id/record', protect, upload.fields([{ name: 'chartImage', maxCount: 8 }, { name: 'chartImages', maxCount: 8 }]), A(sessionsController.postRecord));
router.get('/sessions/:id/reflect', protect, A(sessionsController.getReflect));
router.post('/sessions/:id/reflect', protect, A(sessionsController.postReflect));
router.get('/sessions/:id/chart-image/:index', protect, A(sessionsController.getChartImage));
router.get('/sessions/:id/chart-image', protect, A(sessionsController.getChartImage));
router.get('/sessions/:id', protect, A(sessionsController.getDetail));

// Legacy journal: form handler kept working; the page redirects to Sessions
router.post('/journal', protect, upload.single('chartImage'), A(dashboardController.addJournal));
router.get('/journal', protect, (req, res) => res.redirect('/dashboard/sessions'));

router.get('/chart', protect, (req, res) => {
  res.redirect('/chart');
});

module.exports = router;
