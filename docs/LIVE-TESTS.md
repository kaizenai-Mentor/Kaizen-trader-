# Live tests — boot + journey

Two test files reach outside the unit-test harness. They are OFF by
default so `npm test` stays deterministic and needs no network, no
database, and no environment variables.

## `test/live-boot.test.js` — real HTTP boot

Covers: the server actually LISTENS, and real HTTP responses carry what
the launch-day fixes promise (news page renders articles, reputation
page keeps only the Mantle card, menu says "Reputation", language picker
present on welcome/login/register).

Set `LIVE_BOOT=1` to run it. It boots the app on an ephemeral port and
speaks plain HTTP to it. No database required (pages that need one are
excluded from assertions).

## `test/live-journey.test.js` — the whole-site journey

Covers: register → plan (custom risk) → record (screenshot) → detail
("THE CHART — AS RECORDED") end to end, plus whole-site language
assertions under auth for all five dictionaries.

Set `TEST_MONGODB_URI` to a **throwaway** database to run it:

```sh
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/kaizen-test npm test
```

Rules (enforced in the test itself):

- **Never production.** The test REFUSES to run if `TEST_MONGODB_URI`
  equals the production `MONGODB_URI`. Use a scratch database you can
  drop — the journey creates real users and sessions.
- **Optional.** Without the variable the test skips cleanly; the merge
  gate is `npm test` = 128 pass + 1 skip.
- **Render needs nothing.** Tests do not run at deploy; no env keys are
  added for this.

## Why live at all

The unit suite mocks routes and templates. The launch-day bugs (empty
news page, wrong menu label, page bloat) all lived in the wiring between
server, route, and template — exactly the layer unit tests cannot see.
One boot + one journey through the real stack keeps that layer honest.
