/* Voice-to-text only: the browser handles recognition; KAIZEN receives text
 * only when the trader explicitly sends or saves it. */
(function () {
  'use strict';
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var active = null;
  var forms = [];

  function say(control, message) { control.status.textContent = message; }
  function setButton(control, listening) {
    control.button.setAttribute('aria-pressed', listening ? 'true' : 'false');
    control.button.setAttribute('aria-label', listening ? 'Stop voice dictation' : 'Start voice dictation');
    control.button.title = listening ? 'Stop voice dictation' : 'Start voice dictation';
    control.label.textContent = listening ? 'Stop' : 'Speak';
    control.button.classList.toggle('is-listening', listening);
  }
  function canSubmit(targetId) {
    if (!active || (targetId && active.target.id !== targetId)) return true;
    say(active, 'Stop dictation and review the text before sending or saving.');
    return false;
  }
  window.kaizenVoice = { canSubmit: canSubmit };

  function insertText(target, spoken) {
    var text = String(spoken || '').trim();
    if (!text) return;
    var start = target.selectionStart == null ? target.value.length : target.selectionStart;
    var end = target.selectionEnd == null ? start : target.selectionEnd;
    var before = target.value.slice(0, start);
    var after = target.value.slice(end);
    var prefix = before && !/\s$/.test(before) ? ' ' : '';
    var suffix = after && !/^\s|^[.,!?;:]/.test(after) ? ' ' : '';
    target.setRangeText(prefix + text + suffix, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function finish(control, message) {
    if (active !== control) return;
    if (control.restartTimer) window.clearTimeout(control.restartTimer);
    if (control.waitTimer) window.clearTimeout(control.waitTimer);
    control.restartTimer = null;
    control.waitTimer = null;
    control.recognition = null;
    control.stopping = false;
    active = null;
    control.button.disabled = false;
    setButton(control, false);
    say(control, message || 'Dictation stopped. Review and edit the text before sending or saving.');
  }

  // Android Chrome can end a recognition session after a short pause even
  // when continuous is set. Start a fresh session until the trader stops it.
  function startRecognition(control) {
    if (active !== control || control.stopping) return;
    var recognition;
    try { recognition = new SpeechRecognition(); }
    catch (_) { finish(control, 'Voice input could not start. You can still type.'); return; }
    var seen = {};
    var fatalError = '';
    var gotSpeech = false;
    var interimText = '';
    control.recognition = recognition;
    recognition.continuous = true;
    // Android Chrome can emit interim results without ever finalizing them.
    recognition.interimResults = true;
    var pageLanguage = document.documentElement.lang || 'en';
    var browserLanguage = (window.navigator && window.navigator.language) || '';
    recognition.lang = browserLanguage.toLowerCase().split('-')[0] === pageLanguage.toLowerCase().split('-')[0]
      ? browserLanguage : (pageLanguage === 'en' ? 'en-US' : pageLanguage);
    recognition.onstart = function () {
      if (active !== control || control.recognition !== recognition || control.stopping) return;
      say(control, 'Listening. Tap Stop when you are finished.');
      control.waitTimer = window.setTimeout(function () {
        control.waitTimer = null;
        if (active === control && control.recognition === recognition && !control.stopping && !gotSpeech)
          say(control, 'No words received yet. Check microphone permission and your connection, or stop and type.');
      }, 12000);
    };
    recognition.onresult = function (event) {
      if (active !== control || control.recognition !== recognition) return;
      if (control.waitTimer) window.clearTimeout(control.waitTimer);
      control.waitTimer = null;
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        if (result.isFinal && !seen[i] && result[0]) {
          seen[i] = true;
          gotSpeech = true;
          control.emptyRestarts = 0;
          insertText(control.target, result[0].transcript);
        }
      }
      var interim = [];
      for (var j = 0; j < event.results.length; j++) {
        if (!event.results[j].isFinal && event.results[j][0]) interim.push(event.results[j][0].transcript);
      }
      interimText = interim.join(' ').trim();
      if (interimText) {
        gotSpeech = true;
        control.emptyRestarts = 0;
        say(control, 'Hearing: ' + interimText + ' (review before sending)');
      } else if (!control.stopping) {
        say(control, 'Listening. Tap Stop when you are finished.');
      }
    };
    recognition.onerror = function (event) {
      if (active !== control || control.recognition !== recognition) return;
      if (event.error === 'no-speech') return; // retry after the browser ends this session
      if (event.error === 'aborted' && control.stopping) return;
      var messages = {
        'not-allowed': 'Microphone or speech access was denied. Check browser permissions and try again.',
        'service-not-allowed': 'Speech recognition is unavailable in this browser. You can still type.',
        'audio-capture': 'No microphone was available. Check your device settings and try again.',
        'network': 'Speech recognition needs a working network connection. You can still type.',
        'aborted': 'Dictation stopped.'
      };
      fatalError = messages[event.error] || 'Voice input stopped. You can still type or try again.';
      say(control, fatalError);
    };
    recognition.onend = function () {
      if (active !== control || control.recognition !== recognition) return;
      if (control.waitTimer) window.clearTimeout(control.waitTimer);
      control.waitTimer = null;
      control.recognition = null;
      // Preserve the latest provisional words if the browser ends without a final result.
      if (interimText) insertText(control.target, interimText);
      if (control.stopping || fatalError) return finish(control, fatalError);
      if (!gotSpeech) control.emptyRestarts++;
      if (control.emptyRestarts >= 5) {
        return finish(control, 'No speech detected. Tap Speak to start again.');
      }
      say(control, 'Listening paused. Restarting microphone; tap Stop to finish.');
      control.restartTimer = window.setTimeout(function () {
        control.restartTimer = null;
        startRecognition(control);
      }, 350);
    };
    try { recognition.start(); }
    catch (_) { finish(control, 'Voice input could not restart. Check microphone access or type instead.'); }
  }

  function begin(control) {
    active = control;
    control.stopping = false;
    control.emptyRestarts = 0;
    setButton(control, true);
    say(control, 'Starting microphone. Allow access if your browser asks.');
    startRecognition(control);
  }

  document.querySelectorAll('[data-voice-target]').forEach(function (button) {
    var target = document.getElementById(button.getAttribute('data-voice-target'));
    var status = document.getElementById(button.getAttribute('data-voice-status'));
    if (!target || !status) return;
    var control = { button: button, target: target, status: status, label: button.querySelector('[data-voice-label]') };
    if (!window.isSecureContext) {
      button.disabled = true;
      say(control, 'Voice input requires HTTPS or localhost. You can still type.');
    } else if (!SpeechRecognition) {
      button.disabled = true;
      say(control, 'Voice input is not supported by this browser. You can still type.');
    } else {
      button.addEventListener('click', function () {
        if (active === control) {
          if (control.stopping) return;
          control.stopping = true;
          control.button.disabled = true;
          say(control, 'Finishing dictation. Please wait to review the text.');
          if (control.restartTimer) {
            window.clearTimeout(control.restartTimer);
            return finish(control);
          }
          try { control.recognition.stop(); }
          catch (_) { finish(control); }
        } else if (active) {
          say(control, 'Stop the other dictation before starting this one.');
        } else {
          begin(control);
        }
      });
    }
    if (target.form && forms.indexOf(target.form) === -1) {
      forms.push(target.form);
      target.form.addEventListener('submit', function (event) {
        if (active && active.target.form === target.form && !canSubmit(active.target.id)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
    }
  });
  window.addEventListener('pagehide', function () {
    if (active) {
      var control = active;
      var recognition = control.recognition;
      finish(control);
      if (recognition) { try { recognition.abort(); } catch (_) {} }
    }
  });
})();
