const crypto = require('crypto');

function googleConfig(env = process.env) {
  const clientID = String(env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(env.GOOGLE_CLIENT_SECRET || '').trim();
  const base = String(env.APP_URL || (env.NODE_ENV === 'production'
    ? 'https://kaizen-trader.onrender.com' : `http://localhost:${env.PORT || 3000}`)).trim().replace(/\/+$/, '');
  const callbackURL = String(env.GOOGLE_CALLBACK_URL || base + '/auth/google/callback').trim();
  try {
    const url = new URL(callbackURL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/auth/google/callback') return null;
  } catch (_) { return null; }
  if (!clientID || !clientSecret || clientID === 'placeholder' || clientSecret === 'placeholder') return null;
  return { clientID, clientSecret, callbackURL };
}

/** Google must attest the email before it can identify or link an account. */
async function findOrCreateGoogleUser(profile, User, sendWelcomeEmail) {
  if (!profile || !profile.id) throw new Error('Google profile has no id');
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  const emailEntry = emails.find(e => e && e.value && (e.verified === true || (profile._json && profile._json.email_verified === true)));
  if (!emailEntry) throw new Error('Google did not provide a verified email');
  const email = String(emailEntry.value).trim().toLowerCase();
  let user = await User.findOne({ googleId: profile.id });
  if (user) return user;
  user = await User.findOne({ email });
  if (user) {
    if (user.googleId && user.googleId !== profile.id) throw new Error('Google account does not match existing link');
    const hostedDomain = profile._json && profile._json.hd;
    const googleAuthoritative = email.endsWith('@gmail.com') ||
      (typeof hostedDomain === 'string' && email.endsWith('@' + hostedDomain.toLowerCase()));
    if (!googleAuthoritative) throw new Error('Existing account requires a separately verified link');
    user.googleId = profile.id;
    await user.save();
    return user;
  }
  const name = String(profile.displayName || 'trader').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 24) || 'trader';
  user = await User.create({
    username: name + crypto.randomBytes(6).toString('hex'), email, googleId: profile.id,
    authMethod: 'google', isVerified: true, termsAcceptedAt: new Date()
  });
  Promise.resolve().then(() => sendWelcomeEmail(user.email, user.username)).catch(() => {});
  return user;
}

module.exports = { googleConfig, findOrCreateGoogleUser };
