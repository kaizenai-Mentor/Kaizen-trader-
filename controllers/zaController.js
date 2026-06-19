const zaClient = require('../config/za');

// GET /za/bounties
const getBounties = async (req, res) => {
  try {
    const response = await zaClient.get('/bounties');
    const data = response.data;

    const bounties = Array.isArray(data)
      ? data
      : data.data || data.bounties || [];

    res.render('bounties', {
      user: req.session.user,
      bounties,
      error: null
    });

  } catch (error) {
    console.error('ZA Bounties error:', error.message);
    res.render('bounties', {
      user: req.session.user,
      bounties: [],
      error: 'Unable to load bounties right now. Please try again later.'
    });
  }
};

// GET /za/bounties/:id
const getBountyById = async (req, res) => {
  try {
    const response = await zaClient.get(`/bounties/${req.params.id}`);
    const bounty = response.data;

    res.render('bounty-detail', {
      user: req.session.user,
      bounty: bounty || {}
    });

  } catch (error) {
    console.error('ZA Bounty detail error:', error.message);
    res.render('bounty-detail', {
      user: req.session.user,
      bounty: {}
    });
  }
};

// GET /za/reputation/:userId
const getReputation = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);

    if (!user) return res.redirect('/dashboard');

    let zaData = null;
    try {
      const searchName = user.username
        ? user.username.replace(/-/g, '').toLowerCase()
        : '';

      // Step 1 — find user via dedicated search endpoint
      const searchRes = await zaClient.get('/users/search', {
        params: { q: searchName, type: 'username', limit: 5 }
      });

      const searchResults = searchRes.data?.data;
      if (searchResults && searchResults.length > 0) {
        const found = user.zaUserId
          ? searchResults.find(u => u.id === user.zaUserId) || searchResults[0]
          : searchResults[0];

        // Step 2 — fetch full profile with stats
        const profileRes = await zaClient.get('/users', {
          params: { search: found.username, limit: 1, includeStats: true }
        });

        const profileResults = profileRes.data?.data;
        zaData = profileResults && profileResults.length > 0
          ? profileResults[0]
          : found;

        console.log('ZA data found:', zaData.username,
          '| Activity:', zaData.activityScore);
      } else {
        console.log('ZA: no results for:', searchName);
      }

    } catch (zaErr) {
      console.log('ZA Reputation error:', zaErr.message);
      zaData = null;
    }

    res.render('reputation', {
      user: req.session.user,
      profileUser: user,
      disciplineScore: user.disciplineScore || 0,
      totalSessions: user.totalSessions || 0,
      streak: user.streak || 0,
      zaData,
      reputation: zaData,
      error: null
    });

  } catch (error) {
    console.error('Reputation page error:', error.message);
    res.redirect('/dashboard');
  }
};

module.exports = {
  getBounties,
  getBountyById,
  getReputation
};
