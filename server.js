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

const Memory = require('./models/Memory');

// Kaizen AI page
app.get('/kaizen-ai', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const aiResponse = req.session.aiResponse || null;
  // Clear after reading
  if (req.session.aiResponse) {
    delete req.session.aiResponse;
  }
  res.render('kaizen-ai', {
    user: req.session.user,
    aiResponse: aiResponse
  });
});

// Test
app.get('/test-ai', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.send('NO API KEY SET');
  }
  try {
    const https = require('https');
    const payload = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say: KAIZEN AI is working.' }]
    });
    const response = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload)
        }
      }, (res2) => {
        let data = '';
        res2.on('data', c => data += c);
        res2.on('end', () => resolve(data));
      });
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });
    res.send(response);
  } catch(e) {
    res.send('ERROR: ' + e.message);
  }
});

// Memories page
app.get('/memories', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  try {
    const memories = await Memory.find({
      userId: req.session.user.id
    }).sort({ createdAt: -1 });
    res.render('memories', { user: req.session.user, memories });
  } catch (err) {
    res.render('memories', { user: req.session.user, memories: [] });
  }
});

// Save memory (called from client after AI response)
app.post('/memories/save', async (req, res) => {
  if (!req.session.user) return res.json({ success: false });
  try {
    const { sessionData, response } = req.body;
    await Memory.create({
      userId: req.session.user.id,
      sessionData: sessionData || '',
      response: response || ''
    });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/journal', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.redirect('/dashboard/journal');
});

// Weekly summary (can be triggered manually or by cron)
app.get('/weekly-summary', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');

  try {
    const Journal = require('./models/Journal');
    const User = require('./models/User');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weekJournals = await Journal.find({
      userId: req.session.user.id,
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 });

    const user = await User.findById(req.session.user.id);

    if (weekJournals.length === 0) {
      return res.render('weekly-summary', {
        user,
        summary: null,
        weekJournals: []
      });
    }

    const compliant = weekJournals.filter(j => j.ruleCompliance).length;
    const weekScore = Math.round((compliant / weekJournals.length) * 100);
    const allText = weekJournals.map(j => j.notes).join('\n\n');

    let summary = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const https = require('https');
        const payload = JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 600,
          system: `You are Kaizen AI generating a weekly trading discipline report for ${user.username}.

Be specific. Be honest. Reference actual patterns from their sessions.
Format with these sections:
WEEK IN REVIEW
[2-3 sentences summarizing the week]

STRONGEST MOMENT
[The best thing they did this week — be specific]

BIGGEST PATTERN TO FIX
[The one thing that most needs improvement — be direct]

WEEK SCORE: ${weekScore}%
NEXT WEEK FOCUS
[One specific behavioral goal for next week]`,
          messages: [{
            role: 'user',
            content: `Sessions this week: ${weekJournals.length}
Compliant sessions: ${compliant}
Rule compliance rate: ${weekScore}%

All journal entries this week:
${allText.substring(0, 2000)}`
          }]
        });

        const response = await new Promise((resolve, reject) => {
          const req2 = https.request({
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload)
            }
          }, (r) => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => resolve(d));
          });
          req2.on('error', reject);
          req2.setTimeout(20000, () => { req2.destroy(); reject(new Error('Timeout')); });
          req2.write(payload);
          req2.end();
        });

        const parsed = JSON.parse(response);
        summary = parsed.content?.[0]?.text || 'Summary unavailable.';
      } catch (e) {
        summary = `Week Score: ${weekScore}%\n\nYou logged ${weekJournals.length} sessions this week with ${compliant} compliant. Keep building consistency.`;
      }
    } else {
      summary = `Week Score: ${weekScore}%\n\nYou logged ${weekJournals.length} sessions this week with ${compliant} compliant.`;
    }

    res.render('weekly-summary', {
      user,
      summary,
      weekJournals,
      weekScore,
      compliant
    });

  } catch (err) {
    console.error('Weekly summary error:', err.message);
    res.redirect('/dashboard');
  }
});

// Test email route
app.get('/test-email', async (req, res) => {
  if (!process.env.RESEND_API_KEY) {
    return res.send('RESEND_API_KEY not set on Render');
  }
  try {
    const { sendWelcomeEmail } = require('./config/email');
    const testEmail = req.query.email || (req.session.user && req.session.user.email);
    if (!testEmail) {
      return res.send('Add ?email=youremail@gmail.com to the URL');
    }
    await sendWelcomeEmail(testEmail, 'TestUser');
    res.send(`Test email sent to ${testEmail} — check your inbox and spam folder`);
  } catch (err) {
    res.send('Email failed: ' + err.message);
  }
});

// Admin stats — only accessible with secret key
app.get('/admin/stats', async (req, res) => {
  const adminKey = req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).send('Forbidden');
  }

  try {
    const User = require('./models/User');
    const Journal = require('./models/Journal');

    const totalUsers = await User.countDocuments();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUserIds = await Journal.distinct('userId', {
      createdAt: { $gte: sevenDaysAgo }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyActiveIds = await Journal.distinct('userId', {
      createdAt: { $gte: thirtyDaysAgo }
    });

    const totalJournals = await Journal.countDocuments();
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('username email createdAt disciplineScore streak');

    res.json({
      totalUsers,
      weeklyActiveUsers: activeUserIds.length,
      monthlyActiveUsers: monthlyActiveIds.length,
      totalJournalEntries: totalJournals,
      avgEntriesPerUser: totalUsers > 0
        ? Math.round(totalJournals / totalUsers)
        : 0,
      recentSignups: recentUsers
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Info pages
app.get('/about', (req, res) => res.render('about', { user: req.session.user || null }));
app.get('/services', (req, res) => res.render('services', { user: req.session.user || null }));
app.get('/support', (req, res) => res.render('support', { user: req.session.user || null }));
app.get('/privacy', (req, res) => res.render('privacy', { user: req.session.user || null }));
app.get('/terms', (req, res) => res.render('terms', { user: req.session.user || null }));
app.get('/help', (req, res) => res.render('help', { user: req.session.user || null }));

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
