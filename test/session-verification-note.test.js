const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const filename = path.resolve('views/session-detail.ejs');
const template = fs.readFileSync(filename, 'utf8');
function render(brokerCheck) {
  return ejs.render(template, {
    lang: 'en', t: key => key, user: {},
    session: { _id: '123', state: 'ANALYZED', sessionType: 'LIVE', asset: 'XAUUSD', createdAt: new Date(), notes: 'Journal' },
    labels: { state: value => value, type: value => value, outcome: value => value },
    review: { summary: 'Summary', noticed: [], concerns: 'Concerns', didWell: 'Well', nextImprovement: 'Next' },
    score: null, brokerCheck
  }, { filename, includer: () => ({ template: '<!-- partial omitted -->' }) });
}

test('unverified account history note is absent but verified confirmation remains visible', () => {
  const unverified = render({ verified: false, status: 'UNVERIFIED', verificationNote: 'Unmatched account history note' });
  assert.doesNotMatch(unverified, /ACCOUNT HISTORY VERIFICATION|Unmatched account history note/);
  const verified = render({ verified: true, status: 'VERIFIED', verificationNote: 'Confirmed broker trade' });
  assert.match(verified, /BROKER-VERIFIED EXECUTION/);
  assert.match(verified, /Confirmed broker trade/);
  const study = render({ verified: false, status: 'STUDY_EXEMPT', verificationNote: 'Study' });
  assert.doesNotMatch(study, /BROKER-VERIFIED EXECUTION|ACCOUNT HISTORY VERIFICATION/);
});
