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

  function begin(control) {
    var recognition;
    try { recognition = new SpeechRecognition(); }
    catch (_) { say(control, 'Voice input could not start. You can still type.'); return; }
    var seen = {};
    var errorMessage = '';
    control.recognition = recognition;
    active = control;
    setButton(control, true);
    say(control, 'Starting microphone. Allow access if your browser asks.');
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = document.documentElement.lang || 'en';
    recognition.onstart = function () {
      if (active === control && control.recognition === recognition) say(control, 'Listening. Tap Stop when you are finished.');
    };
    recognition.onresult = function (event) {
      if (active !== control || control.recognition !== recognition) return;
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        if (result.isFinal && !seen[i] && result[0]) {
          seen[i] = true;
          insertText(control.target, result[0].transcript);
        }
      }
    };
    recognition.onerror = function (event) {
      if (active !== control || control.recognition !== recognition) return;
      var messages = {
        'not-allowed': 'Microphone or speech access was denied. Check browser permissions and try again.',
        'service-not-allowed': 'Speech recognition is unavailable in this browser. You can still type.',
        'audio-capture': 'No microphone was available. Check your device settings and try again.',
        'network': 'Speech recognition needs a working network connection. You can still type.',
        'no-speech': 'No speech was detected. Tap Speak to try again.',
        'aborted': 'Dictation stopped.'
      };
      errorMessage = messages[event.error] || 'Voice input stopped. You can still type or try again.';
      say(control, errorMessage);
    };
    recognition.onend = function () {
      if (active !== control || control.recognition !== recognition) return;
      active = null;
      control.recognition = null;
      control.stopping = false;
      control.button.disabled = false;
      setButton(control, false);
      say(control, errorMessage || 'Dictation stopped. Review and edit the text before sending or saving.');
    };
    try { recognition.start(); }
    catch (_) {
      active = null;
      control.recognition = null;
      setButton(control, false);
      say(control, 'Voice input could not start. Check microphone access or type instead.');
    }
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
          try { control.recognition.stop(); }
          catch (_) { control.recognition.onend(); }
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
    if (active && active.recognition) {
      try { active.recognition.abort(); } catch (_) {}
    }
  });
})();
