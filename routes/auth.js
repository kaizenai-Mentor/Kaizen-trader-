const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);
router.post('/verify-otp', authController.verifyOTP);
router.post('/onboarding', authController.handleOnboarding);
router.get('/onboarding/rules', authController.getOnboardingRules);
router.post('/onboarding/rules', authController.postOnboardingRules);
router.post('/onboarding/skip', authController.skipOnboardingRules);
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/logout', authController.logout);
router.post('/change-password', protect, authController.changePassword);
router.post('/delete-account', protect, authController.deleteAccount);

module.exports = router;
