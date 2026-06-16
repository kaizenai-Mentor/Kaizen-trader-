const BADGES = require('./badges');

async function checkAndAwardBadges(userId) {
  try {
    const User = require('../models/User');
    const Journal = require('../models/Journal');
    const Memory = require('../models/Memory');

    const user = await User.findById(userId);
    if (!user) return [];

    const allJournals = await Journal.find({ userId });
    const psychSessions = await Memory.find({
      userId,
      $or: [
        { type: 'psychology' },
        { asset: 'Psychology Session' }
      ]
    });

    // Check perfect week
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekJournals = allJournals.filter(j =>
      new Date(j.createdAt) >= sevenDaysAgo
    );
    const perfectWeek = weekJournals.length >= 7 &&
      weekJournals.every(j => j.ruleCompliance);

    // Count honest violations
    const honestViolations = allJournals.filter(j =>
      !j.ruleCompliance
    ).length;

    const stats = {
      totalSessions: allJournals.length,
      disciplineScore: user.disciplineScore || 0,
      streak: user.streak || 0,
      psychSessions: psychSessions.length,
      perfectWeek,
      honestViolations,
      comeback: false // calculated below
    };

    // Check comeback (simplified)
    if (allJournals.length >= 20) {
      const older = allJournals.slice(10, 20);
      const newer = allJournals.slice(0, 10);
      const olderScore = Math.round(
        older.filter(j => j.ruleCompliance).length / older.length * 100
      );
      const newerScore = Math.round(
        newer.filter(j => j.ruleCompliance).length / newer.length * 100
      );
      stats.comeback = newerScore >= olderScore + 20;
    }

    // Find which badges user already has
    const existingBadgeIds = (user.badges || []).map(b => b.id);

    // Check which new badges are earned
    const newBadges = [];
    for (const badge of BADGES) {
      if (!existingBadgeIds.includes(badge.id) && badge.check(stats)) {
        newBadges.push({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          earnedAt: new Date()
        });
      }
    }

    // Award new badges
    if (newBadges.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $push: { badges: { $each: newBadges } }
      });
      console.log(`Awarded ${newBadges.length} badge(s) to ${user.username}:`,
        newBadges.map(b => b.name).join(', '));
    }

    return newBadges;

  } catch(err) {
    console.error('Badge check error:', err.message);
    return [];
  }
}

module.exports = checkAndAwardBadges;
