require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const morgan = require('morgan');
const helmet = require('helmet');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const connectDB = require('./config/db');
const User = require('./models/User');
const { sendWelcomeEmail } = require('./config/email');

// Connect DB
connectDB();

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 2 * 60 * 60
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 2 * 60 * 60 * 1000
  }
}));

// Auto logout after 2 hours inactivity
app.use((req, res, next) => {
  if (req.session.user) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const inactiveTime = now - lastActivity;
    const maxInactive = 2 * 60 * 60 * 1000;

    if (inactiveTime > maxInactive) {
      req.session.destroy();
      return res.redirect('/?timeout=true');
    }
    req.session.lastActivity = now;
  }
  next();
});

// Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
  callbackURL: `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.googleId = profile.id;
        user.authMethod = 'google';
        await user.save();
      } else {
        const username = profile.displayName.replace(/\s+/g, '').toLowerCase() +
          Math.floor(Math.random() * 999);
        user = await User.create({
          username,
          email: profile.emails[0].value,
          googleId: profile.id,
          authMethod: 'google',
          isVerified: true
        });
        await sendWelcomeEmail(user.email, user.username);
      }
    }
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Make user available in views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Google Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login' }),
  async (req, res) => {
    req.session.user = {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      disciplineScore: req.user.disciplineScore,
      streak: req.user.streak
    };
    res.redirect('/dashboard');
  }
);

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const zaRoutes = require('./routes/za');

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/za', zaRoutes);
const chartRoutes = require('./routes/chart');
app.use('/chart', chartRoutes);

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('welcome', {
    deleted: req.query.deleted || null
  });
});

// Info pages
app.get('/about', (req, res) => res.render('about', { user: req.session.user || null }));
app.get('/services', (req, res) => res.render('services', { user: req.session.user || null }));
app.get('/support', (req, res) => res.render('support', { user: req.session.user || null }));
app.get('/privacy', (req, res) => res.render('privacy', { user: req.session.user || null }));
app.get('/terms', (req, res) => res.render('terms', { user: req.session.user || null }));
app.get('/help', (req, res) => res.render('help', { user: req.session.user || null }));

// Kaizen AI page
app.get('/kaizen-ai', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.render('kaizen-ai', { user: req.session.user });
});

// Memories page
app.get('/memories', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.render('memories', { user: req.session.user });
});

// Support form submission
app.post('/support/send', async (req, res) => {
  try {
    const { name, email, issue, message } = req.body;
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      auth: {
        user: process.env.BREVO_SENDER_EMAIL,
        pass: process.env.BREVO_API_KEY
      }
    });

    await transporter.sendMail({
      from: `"KAIZEN Support" <${process.env.BREVO_SENDER_EMAIL}>`,
      to: process.env.BREVO_SENDER_EMAIL,
      subject: `[KAIZEN Support] ${issue} — from ${name}`,
      html: `
        <h2>New Support Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Issue:</strong> ${issue}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    });

    res.redirect('/support?sent=true');
  } catch (error) {
    console.error('Support email error:', error);
    res.redirect('/support?error=true');
  }
});

// Home
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  const deleted = req.query.deleted;
  res.render('welcome', { deleted });
});

// 404
app.use((req, res) => {
  res.status(404).render('welcome', { deleted: null });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KAIZEN running on port ${PORT}`);
});

module.exports = app;
