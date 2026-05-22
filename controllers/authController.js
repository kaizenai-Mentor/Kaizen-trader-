const User = require('../models/User');
const crypto = require('crypto');
const { sendWelcomeEmail, sendOTPEmail } = require('../config/email');

// Generate 3-digit OTP
const generateOTP = () => {
  return Math.floor(100 + Math.random() * 900).toString();
};

// GET /auth/register
const getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { error: null, step: 'form' });
};

// POST /auth/register — Step 1: collect details, send OTP
const postRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword,
      traderType, experience, markets, timeframes, riskPerTrade } = req.body;

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

    // Store pending registration in session
    const otp = generateOTP();
    req.session.pendingUser = {
      username,
      email,
      password,
      tradingStyle: { traderType, experience, markets, timeframes, riskPerTrade },
      otp,
      otpExpiresAt: Date.now() + 10 * 60 * 1000
    };

    // Send OTP
    await sendOTPEmail(email, otp);

    res.render('register', {
      error: null,
      step: 'otp',
      email: email
    });

  } catch (error) {
    console.error('Register error:', error);
    res.render('register', {
      error: 'Something went wrong. Please try again.',
      step: 'form'
    });
  }
};

// POST /auth/verify-otp
const verifyOTP = async (req, res) => {
  try {
    const { otp1, otp2, otp3 } = req.body;
    const enteredOTP = `${otp1}${otp2}${otp3}`;
    const pending = req.session.pendingUser;

    if (!pending) {
      return res.render('register', {
        error: 'Session expired. Please register again.',
        step: 'form'
      });
    }

    if (Date.now() > pending.otpExpiresAt) {
      return res.render('register', {
        error: 'OTP expired. Please register again.',
        step: 'form'
      });
    }

    if (enteredOTP !== pending.otp) {
      return res.render('register', {
        error: 'Incorrect code. Please try again.',
        step: 'otp',
        email: pending.email
      });
    }

    // Create user
    const user = await User.create({
      username: pending.username,
      email: pending.email,
      password: pending.password,
      tradingStyle: pending.tradingStyle,
      isVerified: true,
      authMethod: 'password'
    });

    // Clear pending
    delete req.session.pendingUser;

    // Send welcome email
    await sendWelcomeEmail(user.email, user.username);

    // Create session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      disciplineScore: user.disciplineScore,
      streak: user.streak
    };

    res.redirect('/dashboard');

  } catch (error) {
    console.error('OTP verify error:', error);
    res.render('register', {
      error: 'Verification failed. Please try again.',
      step: 'form'
    });
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

    await User.findByIdAndDelete(userId);

    const Journal = require('../models/Journal');
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
  getLogin,
  postLogin,
  logout,
  changePassword,
  deleteAccount
};
