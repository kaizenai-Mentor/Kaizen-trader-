/**
 * scripts/check-ai.js — one-command AI provider check.
 *
 * Run from the repo root (where .env lives):
 *   node scripts/check-ai.js
 *
 * - Prints which provider keys are configured (keys are NEVER printed —
 *   only set / not set).
 * - If a key is configured, sends a tiny real request and prints the
 *   actual reply, so "is it working?" is answered in one command.
 * - Also verifies the streaming path.
 *
 * Exit codes: 0 = provider working (or none configured, which is a valid
 * state — deterministic fallbacks), 1 = a key is set but the call failed.
 */
require('dotenv').config();
const llm = require('../services/llm');

(async () => {
  const envNames = {
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GEMINI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY'
  };
  const models = {
    anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    gemini: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    openrouter: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash'
  };

  console.log('KAIZEN AI provider check');
  console.log('-----------------------');
  for (const [name, env] of Object.entries(envNames)) {
    const set = !!process.env[env];
    console.log(
      (set ? '[x] ' : '[ ] ') + name.padEnd(11) +
      (set ? ' key set   model: ' + models[name] : ' not set (' + env + ')')
    );
  }

  const active = llm.activeProvider();
  if (!active) {
    console.log('');
    console.log('No provider key configured. That is a valid state:');
    console.log('every AI surface uses the honest deterministic fallbacks.');
    console.log('Add GEMINI_API_KEY or OPENROUTER_API_KEY to .env to go live.');
    return;
  }

  console.log('');
  console.log('Active provider: ' + active + '  (priority: anthropic > gemini > openrouter)');
  console.log('Sending a tiny test request...');

  let ok = true;
  try {
    const t0 = Date.now();
    const reply = await llm.callLLM(
      'You are a connectivity test. Reply with exactly: KAIZEN AI PATH OK',
      'Reply now.',
      { maxTokens: 400 }
    );
    console.log('Reply (' + (Date.now() - t0) + ' ms): ' + JSON.stringify(String(reply).slice(0, 100)));
    console.log('GENERATION: WORKING');
  } catch (e) {
    ok = false;
    console.log('GENERATION: FAILED — ' + e.message);
  }

  try {
    let streamed = '';
    for await (const chunk of llm.streamLLM(
      'You are a connectivity test. Reply with exactly: STREAM OK',
      'Reply now.',
      { maxTokens: 400 }
    )) {
      streamed += chunk;
    }
    console.log('STREAMING:  WORKING (' + JSON.stringify(streamed.slice(0, 60)) + ')');
  } catch (e) {
    ok = false;
    console.log('STREAMING:  FAILED — ' + e.message);
  }

  console.log('');
  if (ok) {
    console.log('All good. AI responses are live on every surface:');
    console.log('session analysis, weekly letter, KAIZEN AI chat, Psychology chat.');
  } else {
    console.log('A key is set but the call failed. Check, in this order:');
    console.log('1. Is the key copied whole (no spaces, no quotes, one line)?');
    console.log('2. Does the key have quota left? (free tiers reset daily at');
    console.log('   midnight Pacific time for Gemini)');
    console.log('3. If both generation and streaming fail with HTTP 401/403,');
    console.log('   the key itself is wrong or revoked — issue a fresh one.');
    process.exitCode = 1;
  }
})();
