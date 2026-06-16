const BADGES = [
  // Journal badges
  {
    id: 'first_session',
    name: 'First Step',
    emoji: '改',
    description: 'Logged your first trading session',
    check: (stats) => stats.totalSessions >= 1
  },
  {
    id: 'sessions_5',
    name: 'Building Blocks',
    emoji: '📓',
    description: 'Logged 5 trading sessions',
    check: (stats) => stats.totalSessions >= 5
  },
  {
    id: 'sessions_10',
    name: 'Committed',
    emoji: '🔥',
    description: 'Logged 10 trading sessions',
    check: (stats) => stats.totalSessions >= 10
  },
  {
    id: 'sessions_25',
    name: 'Consistent Logger',
    emoji: '📈',
    description: 'Logged 25 trading sessions',
    check: (stats) => stats.totalSessions >= 25
  },
  {
    id: 'sessions_50',
    name: 'Dedicated Trader',
    emoji: '⚡',
    description: 'Logged 50 trading sessions',
    check: (stats) => stats.totalSessions >= 50
  },
  {
    id: 'sessions_100',
    name: 'Century',
    emoji: '💯',
    description: 'Logged 100 trading sessions',
    check: (stats) => stats.totalSessions >= 100
  },

  // Discipline score badges
  {
    id: 'score_40',
    name: 'Building Discipline',
    emoji: '🌱',
    description: 'Reached a discipline score of 40%',
    check: (stats) => stats.disciplineScore >= 40
  },
  {
    id: 'score_60',
    name: 'Consistent Trader',
    emoji: '⭐',
    description: 'Reached a discipline score of 60%',
    check: (stats) => stats.disciplineScore >= 60
  },
  {
    id: 'score_80',
    name: 'Elite Discipline',
    emoji: '🏆',
    description: 'Reached a discipline score of 80%',
    check: (stats) => stats.disciplineScore >= 80
  },
  {
    id: 'score_95',
    name: 'Master of Self',
    emoji: '改善',
    description: 'Reached a discipline score of 95%',
    check: (stats) => stats.disciplineScore >= 95
  },

  // Streak badges
  {
    id: 'streak_3',
    name: 'On a Roll',
    emoji: '🎯',
    description: '3-day compliance streak',
    check: (stats) => stats.streak >= 3
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    emoji: '🗓️',
    description: '7-day compliance streak',
    check: (stats) => stats.streak >= 7
  },
  {
    id: 'streak_14',
    name: 'Fortnight',
    emoji: '💪',
    description: '14-day compliance streak',
    check: (stats) => stats.streak >= 14
  },
  {
    id: 'streak_30',
    name: 'Iron Discipline',
    emoji: '🔱',
    description: '30-day compliance streak',
    check: (stats) => stats.streak >= 30
  },

  // Psychology badges
  {
    id: 'psych_first',
    name: 'Mind Matters',
    emoji: '🧠',
    description: 'Completed your first psychology session',
    check: (stats) => stats.psychSessions >= 1
  },
  {
    id: 'psych_5',
    name: 'Inner Work',
    emoji: '🔮',
    description: 'Completed 5 psychology sessions',
    check: (stats) => stats.psychSessions >= 5
  },
  {
    id: 'psych_10',
    name: 'Mental Edge',
    emoji: '🎭',
    description: 'Completed 10 psychology sessions',
    check: (stats) => stats.psychSessions >= 10
  },

  // Special badges
  {
    id: 'perfect_week',
    name: 'Perfect Week',
    emoji: '✨',
    description: '7 compliant sessions in 7 days',
    check: (stats) => stats.perfectWeek === true
  },
  {
    id: 'comeback',
    name: 'Comeback',
    emoji: '🦅',
    description: 'Raised discipline score by 20% after a decline',
    check: (stats) => stats.comeback === true
  },
  {
    id: 'honest_trader',
    name: 'Honest Trader',
    emoji: '🪞',
    description: 'Logged 10 sessions admitting rule violations',
    check: (stats) => stats.honestViolations >= 10
  }
];

module.exports = BADGES;
