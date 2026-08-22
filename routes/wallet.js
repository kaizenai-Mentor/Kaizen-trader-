const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// API-style auth guard: return 401 JSON instead of redirecting XHRs to login.
const protectApi = (req, res, next) => {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Please log in first.' });
};

// POST /api/wallet/nonce      — start ownership challenge
// POST /api/wallet/verify     — consume nonce + verify signature + link wallet
// GET  /api/wallet/status     — current connection state
// POST /api/wallet/sync       — pull confirmed on-chain activity (Phase 1B)
// GET  /api/wallet/activity   — deterministic behavior metrics (Phase 1B)
// POST /api/wallet/disconnect — soft disconnect (audit trail preserved)
router.post('/nonce', protectApi, walletController.requestNonce);
router.post('/verify', protectApi, walletController.verifyWallet);
router.get('/status', protectApi, walletController.getStatus);
router.post('/sync', protectApi, walletController.syncActivity);
router.get('/activity', protectApi, walletController.getActivity);
router.post('/disconnect', protectApi, walletController.disconnectWallet);

module.exports = router;
