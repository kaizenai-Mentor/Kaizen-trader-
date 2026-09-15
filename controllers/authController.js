const User = require('../models/User');

// GET /auth/register
const getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', {
    error: null,
    step: 'join',
    query: req.query
  });
};

// POST /auth/register
const postRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.render('register', {
        error: 'All fields are required',
        step: 'join'
      });
    }

    if (password !== confirmPassword) {
      return res.render('register', {
        error: 'Passwords do not match',
        step: 'join'
      });
    }

    if (password.length < 6) {
      return res.render('register', {
        error: 'Password must be at least 6 characters',
        step: 'join'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.render('register', {
        error: 'Email or username already taken',
        step: 'join'
      });
    }

    const referredBy = req.body.ref || null;

    const user = await User.create({
      username,
      email,
      password,
      isVerified: true,
      authMethod: 'password',
      referredBy: referredBy || null,
      referralCode: username.toLowerCase().replace(/\s+/g, '-')
    });

    if (referredBy) {
      try {
        const referrer = await User.findOne({
          username: { $regex: new RegExp('^' + referredBy + '$', 'i') }
        });
        if (referrer) {
          await User.findByIdAndUpdate(referrer._id, {
            $inc: { referralCount: 1 }
          });
        }
      } catch(e) {
        console.error('Referral error:', e.message);
      }
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      disciplineScore: user.disciplineScore,
      streak: user.streak
    };

    // JOIN done → RULES next (PRG)
    return res.redirect('/auth/onboarding/rules');

  } catch (error) {
    console.error('Register error:', error);
    res.render('register', {
      error: 'Something went wrong. Please try again.',
      step: 'join'
    });
  }
};

// POST /auth/verify-otp — kept for route compatibility but skipped
const verifyOTP = (req, res) => {
  res.redirect('/auth/register');
};

// POST /auth/onboarding — legacy 5-question flow retired in V2;
// send anyone still posting here to the guided system step.
const handleOnboarding = (req, res) => {
  if (!req.session.user) return res.redirect('/auth/register');
  res.redirect('/auth/onboarding/rules');
};

// GET /auth/onboarding/rules — RULES: build your first Trading System
const getOnboardingRules = (req, res) => {
  if (!req.session.user) return res.redirect('/auth/register');
  res.render('register', { error: null, step: 'rules', query: {} });
};

// POST /auth/onboarding/rules — save the guided first system, then PLAN
const postOnboardingRules = async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/register');
  try {
    const TradingSystem = require('../models/TradingSystem');
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/auth/login');
    const system = await TradingSystem.ensureForUser(user);

    const b = req.body;
    const lines = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (b.markets) system.marketConditions = b.markets.trim();
    if (b.tradingHours) system.tradingHours = b.tradingHours.trim();
    system.setups = lines(b.setups).map(name => ({ name }));
    if (b.entryRules) system.entryRules = b.entryRules.trim();
    system.riskRules = {
      ...system.riskRules,
      riskPerTrade: (b.riskPerTrade || '').trim(),
      maxDailyTrades: (b.maxDailyTrades || '').trim(),
      dailyDrawdown: (b.dailyDrawdown || '').trim()
    };

    await system.saveAsNewVersion('First system — built during onboarding.');
    return res.redirect('/dashboard/sessions/new');
  } catch (error) {
    console.error('Onboarding rules error:', error.message);
    res.redirect('/dashboard/sessions/new');
  }
};

// POST /auth/onboarding/skip — blank system v1, refine later
const skipOnboardingRules = async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/register');
  try {
    const TradingSystem = require('../models/TradingSystem');
    const user = await User.findById(req.session.user.id);
    if (user) await TradingSystem.ensureForUser(user);
  } catch (error) {
    console.error('Onboarding skip error:', error.message);
  }
  res.redirect('/dashboard');
};

// GET /auth/login
const getLogin = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null });
};

// POST /auth/login
const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', { error: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('login', { error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password' });
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      disciplineScore: user.disciplineScore,
      streak: user.streak
    };

    res.redirect('/dashboard');

  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Something went wrong. Please try again.' });
  }
};

// GET /auth/logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
};

// POST /auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.redirect('/dashboard?error=Passwords do not match');
    }

    const user = await User.findById(req.session.user.id);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.redirect('/dashboard?error=Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    res.redirect('/dashboard?success=Password updated');

  } catch (error) {
    console.error('Change password error:', error);
    res.redirect('/dashboard?error=Something went wrong');
  }
};

// POST /auth/delete-account
const deleteAccount = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const Journal = require('../models/Journal');

    await User.findByIdAndDelete(userId);
    await Journal.deleteMany({ userId });

    req.session.destroy();
    res.redirect('/?deleted=true');

  } catch (error) {
    console.error('Delete account error:', error);
    res.redirect('/dashboard');
  }
};

module.exports = {
  getRegister,
  postRegister,
  verifyOTP,
  handleOnboarding,
  getOnboardingRules,
  postOnboardingRules,
  skipOnboardingRules,
  getLogin,
  postLogin,
  logout,
  changePassword,
  deleteAccount
};
