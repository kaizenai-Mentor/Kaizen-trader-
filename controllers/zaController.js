const zaClient = require('../config/za');

const BOUNTIES_ENDPOINT = '/bounties';
const USERS_ENDPOINT = '/users';

function logZaError(label, error) {
  const status = error && error.response ? error.response.status : undefined;
  const url = error && error.config
    ? `${error.config.baseURL || ''}${error.config.url || ''}`
    : undefined;

  console.error(`${label}:`, {
    status: status || 'network',
    url,
    message: error && error.message ? error.message : String(error)
  });
}

function renderBounties(res, req, bounties, error) {
  return res.render('bounties', {
    user: req.session.user,
    bounties: Array.isArray(bounties) ? bounties : [],
    error: error || null
  });
}

// GET /za/bounties
const getBounties = async (req, res) => {
  try {
    // The current ZA API is the JSON route /api/bounties. config/za.js
    // normalizes ZA_BASE_URL so this remains correct when only the host is
    // supplied in the environment.
    const response = await zaClient.get(BOUNTIES_ENDPOINT);
    const bounties = zaClient.extractCollection(response.data, ['data', 'bounties']);

    return renderBounties(res, req, bounties, null);
  } catch (error) {
    logZaError('ZA Bounties error', error);
    return renderBounties(
      res,
      req,
      [],
      error && error.response && error.response.status === 404
        ? 'Zero Authority’s bounties API is temporarily unavailable. Please try again later.'
        : 'Unable to load bounties right now. Please try again later.'
    );
  }
};

// GET /za/bounties/:id
const getBountyById = async (req, res) => {
  try {
    const bountyId = encodeURIComponent(req.params.id);
    const response = await zaClient.get(`${BOUNTIES_ENDPOINT}/${bountyId}`);
    const bounty = zaClient.extractEntity(response.data, ['data', 'bounty']);

    return res.render('bounty-detail', {
      user: req.session.user,
      bounty: bounty || {}
    });
  } catch (error) {
    logZaError('ZA Bounty detail error', error);
    return res.render('bounty-detail', {
      user: req.session.user,
      bounty: {}
    });
  }
};

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toLowerCase();
}

function selectZaUser(results, user) {
  if (!Array.isArray(results) || !results.length) return null;
  user = user || {};

  if (user.zaUserId) {
    const byId = results.find(candidate => candidate && candidate.id === user.zaUserId);
    if (byId) return byId;
  }

  // The API applies the search filter. Prefer an exact normalized username
  // when it is present, but retain the first result for older API responses
  // that only return a ranked match.
  const normalizedUsername = normalizeUsername(user.username);
  return results.find(candidate => {
    return normalizeUsername(candidate && candidate.username) === normalizedUsername;
  }) || results[0];
}

// GET /za/reputation/:userId
const getReputation = async (req, res) => {
  try {
    const User = require('../models/User');
    const Journal = require('../models/Journal');
    const mantle = require('../config/mantle');
    const user = await User.findById(req.params.userId);

    if (!user) return res.redirect('/dashboard');

    const totalSessions = await Journal.countDocuments({ user: user._id });

    let mantleEvents = 0;
    let mantleUserStats = { currentScore: 0, sessionCount: 0, milestoneCount: 0 };
    try {
      const totals = await mantle.getTotalEvents();
      mantleEvents = totals.total || 0;
      mantleUserStats = await mantle.getUserStats(user._id);
    } catch (mErr) {
      console.error('Mantle fetch error on reputation:', mErr.message);
    }

    let zaData = null;
    const searchName = normalizeUsername(user.username);

    if (searchName) {
      try {
        // The live API exposes /api/users and returns { users: [...] }.
        // /api/search/users is not a route and consistently returns 404, so
        // do not call it as a fallback.
        const response = await zaClient.get(USERS_ENDPOINT, {
          params: { search: searchName, limit: 5, includeStats: true }
        });
        const results = zaClient.extractCollection(response.data, ['users', 'data']);
        zaData = selectZaUser(results, user);

        if (zaData) {
          console.log('ZA found via users endpoint:', zaData.username || zaData.id);
        } else {
          console.log('ZA: no profile found for:', searchName);
        }
      } catch (error) {
        // Reputation is supplementary; keep the page usable when ZA is down.
        logZaError('ZA user lookup error', error);
      }
    }

    return res.render('reputation', {
      user: req.session.user,
      profileUser: user,
      disciplineScore: user.disciplineScore || 0,
      totalSessions,
      streak: user.streak || 0,
      mantleEvents,
      mantleUserStats,
      zaData,
      reputation: zaData,
      error: null
    });
  } catch (error) {
    logZaError('Reputation page error', error);
    return res.redirect('/dashboard');
  }
};

module.exports = {
  getBounties,
  getBountyById,
  getReputation,
  selectZaUser
};
