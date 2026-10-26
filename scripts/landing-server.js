/**
 * Standalone KAIZEN Landing Page Server
 * Serves the shareable KAIZEN Landing Page (views/landing.ejs) at `/`
 * and handles the Early-User Beta Pipeline (`POST /beta/join`), forwarding
 * `/auth/*` into the main KAIZEN app.
 */
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const BetaTester = require('../models/BetaTester');

const app = express();
const PORT = process.env.LANDING_PORT || process.env.PORT || 3001;
const MAIN_APP_URL = process.env.MAIN_APP_URL || '';

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI).catch(() => {});
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function renderLanding(req, res) {
  res.render('landing', {
    title: 'KAIZEN – Trader Development Platform',
    joined: req.query.joined === '1',
    joinedName: req.query.name || '',
    joinedEmail: req.query.email || ''
  });
}

app.get('/', renderLanding);
app.get('/landing', renderLanding);
app.get('/beta', renderLanding);

app.post('/beta/join', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 140);
  const primaryMarket = String(req.body.primaryMarket || 'Forex').trim().slice(0, 60);
  const stage = String(req.body.stage || 'Learning Trader').trim().slice(0, 60);
  if (email && mongoose.connection.readyState === 1) {
    try {
      await BetaTester.findOneAndUpdate(
        { email },
        { $set: { name: name || 'Trader', email, primaryMarket, stage } },
        { upsert: true, new: true }
      );
    } catch (_) { /* non-fatal */ }
  }
  const params = new URLSearchParams({ joined: '1' });
  if (name) params.set('name', name);
  if (email) params.set('email', email);
  res.redirect('/?' + params.toString() + '#join');
});

app.get('/auth/login', (req, res) => {
  if (MAIN_APP_URL) return res.redirect(MAIN_APP_URL + '/auth/login');
  res.render('login', {
    title: 'KAIZEN — Sign In',
    lang: 'en',
    t: (k) => k,
    error: null,
    googleAuthEnabled: false
  });
});

app.get('/auth/register', (req, res) => {
  if (MAIN_APP_URL) return res.redirect(MAIN_APP_URL + '/auth/register');
  const qs = new URLSearchParams(req.query).toString();
  res.redirect((MAIN_APP_URL || 'https://kaizen-trader.onrender.com') + '/auth/register' + (qs ? '?' + qs : ''));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KAIZEN Landing Page running on port ${PORT}`);
});
