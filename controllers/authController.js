const User = require('../models/User');

// GET /auth/register
const getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { error: null });
};

// POST /auth/register
const postRegister = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      return res.render('register', { error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.render('register', { error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.render('register', { error: 'Email or username already taken' });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password
    });

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
    console.error('Register error:', error);
    res.render('register', { error: 'Something went wrong. Please try again.' });
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

    // Validation
    if (!email || !password) {
      return res.render('login', { error: 'All fields are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('login', { error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password' });
    }

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

module.exports = {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  logout
};