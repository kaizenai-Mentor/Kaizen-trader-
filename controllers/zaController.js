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
  const searchName = user.username
    ? user.username.replace(/-/g, '').toLowerCase()
    : '';

  let zaFound = null;

  // Try /users list endpoint with search param
  try {
    const listRes = await zaClient.get('/users', {
      params: { search: searchName, limit: 5, includeStats: true }
    });
    const listResults = listRes.data?.data;
    if (listResults && listResults.length > 0) {
      zaFound = user.zaUserId
        ? listResults.find(u => u.id === user.zaUserId) || listResults[0]
        : listResults[0];
      console.log('ZA found via list:', zaFound.username);
    }
  } catch (e) {
    console.log('ZA list search failed:', e.message);
  }

  // If not found, try search endpoint
  if (!zaFound) {
    try {
      const searchRes = await zaClient.get('/search/users', {
        params: { q: searchName, type: 'username', limit: 5 }
      });
      const searchResults = searchRes.data?.data;
      if (searchResults && searchResults.length > 0) {
        zaFound = user.zaUserId
          ? searchResults.find(u => u.id === user.zaUserId) || searchResults[0]
          : searchResults[0];
        console.log('ZA found via search:', zaFound.username);
      }
    } catch (e) {
      console.log('ZA search endpoint failed:', e.message);
    }
  }

  zaData = zaFound;
  if (!zaData) console.log('ZA: no profile found for:', searchName);

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
