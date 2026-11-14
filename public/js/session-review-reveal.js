/* Session review streaming: erase a failed response before displaying its replacement. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createSessionReviewReveal = factory;
})(typeof window !== 'undefined' ? window : this, function (options) {
  var out = options.output;
  var status = options.status;
  var typing = options.typing;
  var reduced = !!options.reducedMotion;
  var schedule = options.schedule || function (fn) { return setTimeout(fn, 16); };
  var erasing = false;
  var eraseStep = 1;
  var pending = '';
  var finished = false;
  var notified = false;

  function flush() {
    if (erasing) return;
    if (pending) {
      out.textContent += pending;
      pending = '';
      status.textContent = '';
      typing.hidden = true;
    }
    if (finished && !notified) {
      notified = true;
      typing.hidden = true;
      status.textContent = '';
      options.onDone();
    }
  }
  function erase() {
    var chars = Array.from(out.textContent);
    if (!chars.length || reduced) {
      out.textContent = '';
      erasing = false;
      flush();
      return;
    }
    // A bounded backspace animation even for long partial responses.
    out.textContent = chars.slice(0, -eraseStep).join('');
    schedule(erase);
  }
  return {
    delta: function (text) { pending += text; flush(); },
    reset: function (retrying) {
      // A later provider may also fail while the earlier text is erasing.
      // Discard any queued text from that provider as well.
      pending = '';
      status.textContent = retrying ? 'Trying another provider.' : 'The review was interrupted.';
      typing.hidden = !retrying;
      if (!erasing) {
        erasing = true;
        eraseStep = Math.max(1, Math.ceil(Array.from(out.textContent).length / 25));
        erase();
      }
    },
    done: function () { finished = true; flush(); }
  };
});
