const User = require('../models/User');

// GET /auth/register
const getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', {
    error: null,
    step: 'form',
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
        step: 'form'
      });
    }

    if (password !== confirmPassword) {
      return res.render('register', {
        error: 'Passwords do not match',
        step: 'form'
      });
    }

    if (password.length < 6) {
      return res.render('register', {
        error: 'Password must be at least 6 characters',
        step: 'form'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.render('register', {
        error: 'Email or username already taken',
        step: 'form'
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

    return res.render('register', {
      error: null,
      step: 'questions',
      questionNum: 1
    });

  } catch (error) {
    console.error('Register error:', error);
    res.render('register', {
      error: 'Something went wrong. Please try again.',
      step: 'form'
    });
  }
};

// POST /auth/verify-otp — kept for route compatibility but skipped
const verifyOTP = (req, res) => {
  res.redirect('/auth/register');
};

// POST /auth/onboarding
const handleOnboarding = async (req, res) => {
  try {
    const { questionNum } = req.body;
    const currentQ = parseInt(questionNum);

    if (!req.session.onboarding) {
      req.session.onboarding = {};
    }

    if (currentQ === 1) {
      req.session.onboarding.riskPerTrade = req.body.riskPerTrade;
      req.session.onboarding.dailyDrawdown = req.body.dailyDrawdown;
    } else if (currentQ === 2) {
      req.session.onboarding.tradingEdge = req.body.tradingEdge;
    } else if (currentQ === 3) {
      req.session.onboarding.entryRule = req.body.entryRule;
      req.session.onboarding.stopLossRule = req.body.stopLossRule;
      req.session.onboarding.takeProfitRule = req.body.takeProfitRule;
    } else if (currentQ === 4) {
      const triggers = req.body.emotionalTriggers;
      req.session.onboarding.emotionalTriggers = Array.isArray(triggers)
        ? triggers.join(', ')
        : triggers || '';
    } else if (currentQ === 5) {
      const markets = req.body.markets;
      req.session.onboarding.maxDailyTrades = req.body.maxDailyTrades;
      req.session.onboarding.markets = Array.isArray(markets)
        ? markets.join(', ')
        : markets || '';
      req.session.onboarding.maxPositionSize = req.body.maxPositionSize;

      await User.findByIdAndUpdate(req.session.user.id, {
        tradingStyle: {
          riskPerTrade: req.session.onboarding.riskPerTrade,
          dailyDrawdown: req.session.onboarding.dailyDrawdown,
          tradingEdge: req.session.onboarding.tradingEdge,
          entryRule: req.session.onboarding.entryRule,
          stopLossRule: req.session.onboarding.stopLossRule,
          takeProfitRule: req.session.onboarding.takeProfitRule,
          emotionalTriggers: req.session.onboarding.emotionalTriggers,
          maxDailyTrades: req.session.onboarding.maxDailyTrades,
          markets: req.session.onboarding.markets,
          maxPositionSize: req.session.onboarding.maxPositionSize
        }
      });

      delete req.session.onboarding;
      return res.redirect('/dashboard');
    }

    const nextQ = currentQ + 1;
    return res.render('register', {
      error: null,
      step: 'questions',
      questionNum: nextQ
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    res.redirect('/dashboard');
  }
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
  getLogin,
  postLogin,
  logout,
  changePassword,
  deleteAccount
};
