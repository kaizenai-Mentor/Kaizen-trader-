const User = require('../models/User');
const Journal = require('../models/Journal');

// GET /dashboard
const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const journals = await Journal.find({ userId: req.session.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    const allJournals = await Journal.find({ userId: req.session.user.id });
    let score = 0;

    if (allJournals.length > 0) {
      const compliantSessions = allJournals.filter(j => j.ruleCompliance).length;
      score = Math.round((compliantSessions / allJournals.length) * 100);

      await User.findByIdAndUpdate(req.session.user.id, {
        disciplineScore: score
      });

      req.session.user.disciplineScore = score;
    }

    res.render('dashboard', {
      user,
      journals,
      disciplineScore: score,
      totalSessions: allJournals.length
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/auth/login');
  }
};

// POST /dashboard/journal
const addJournal = async (req, res) => {
  try {
    const {
      asset,
      timeframe,
      notes,
      emotion,
      ruleCompliance,
      direction,
      outcome,
      sessionScore
    } = req.body;

    await Journal.create({
      userId: req.session.user.id,
      asset,
      timeframe,
      notes,
      emotion,
      ruleCompliance: ruleCompliance === 'true',
      direction,
      outcome,
      sessionScore: parseInt(sessionScore) || 50
    });

    res.redirect('/dashboard');

  } catch (error) {
    console.error('Journal error:', error);
    res.redirect('/dashboard');
  }
};

// GET /dashboard/journal
const getJournals = async (req, res) => {
  try {
    const journals = await Journal.find({ 
      userId: req.session.user.id 
    }).sort({ createdAt: -1 });

    const user = await User.findById(req.session.user.id);

    if (!user) {
      return res.redirect('/auth/login');
    }

    res.render('journal', { 
      user, 
      journals: journals || []
    });

  } catch (error) {
    console.error('Journals error:', error.message);
    res.status(500).send(`
      <html>
        <body style="background:#080808;color:#F5F3EF;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#C9A84C;">改 Kaizen</h2>
          <p>Journal temporarily unavailable.</p>
          <a href="/dashboard" style="color:#C9A84C;">← Back to Dashboard</a>
        </body>
      </html>
    `);
  }
};

module.exports = {
  getDashboard,
  addJournal,
  getJournals
};