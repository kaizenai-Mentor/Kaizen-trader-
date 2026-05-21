const zaClient = require('../config/za');

// GET /za/bounties
const getBounties = async (req, res) => {
  try {
    const response = await zaClient.get('/bounties');
    const bounties = response.data;

    res.render('bounties', {
      user: req.session.user,
      bounties: bounties.data || bounties || [],
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

    res.json(bounty);

  } catch (error) {
    console.error('ZA Bounty detail error:', error.message);
    res.json({ error: 'Bounty not found' });
  }
};

// GET /za/reputation/:userId
const getReputation = async (req, res) => {
  try {
    const response = await zaClient.get(`/users/${req.params.userId}/reputation`);
    const reputation = response.data;

    res.render('reputation', {
      user: req.session.user,
      reputation: reputation || {},
      error: null
    });

  } catch (error) {
    console.error('ZA Reputation error:', error.message);
    res.render('reputation', {
      user: req.session.user,
      reputation: {},
      error: 'Unable to load reputation data right now.'
    });
  }
};

module.exports = {
  getBounties,
  getBountyById,
  getReputation
};