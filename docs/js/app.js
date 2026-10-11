// ── KAIZEN CLIENT JS ──

// THEME
function getSavedTheme() {
  try {
    const t = localStorage.getItem('kaizen-theme');
    if (t === 'dark' || t === 'light') return t;
  } catch (e) {}
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
    ? 'light' : 'dark';
}

const savedTheme = getSavedTheme();
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('kaizen-theme', next); } catch (e) {}
  updateThemeIcon(next);
  // Let pages re-render theme-aware widgets (e.g. TradingView chart)
  if (window.__onThemeChange) window.__onThemeChange(next);
}

// POPUP MENU
function togglePopup() {
  const popup = document.getElementById('navPopup');
  const overlay = document.getElementById('popupOverlay');
  popup.classList.toggle('open');
  overlay.classList.toggle('open');
  document.body.style.overflow = popup.classList.contains('open') ? 'hidden' : '';
}

function closePopup() {
  const popup = document.getElementById('navPopup');
  const overlay = document.getElementById('popupOverlay');
  popup.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// MODALS
function openModal(id) {
  closePopup();
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// LANGUAGE
function setLanguage(code, el) {
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.remove('active');
  });
  el.classList.add('active');
  localStorage.setItem('kaizen-lang', code);
  setTimeout(() => closeModal('languageModal'), 500);
}

// SCORE BAR ANIMATION
document.addEventListener('DOMContentLoaded', function() {
  const scoreFills = document.querySelectorAll('.score-fill');
  scoreFills.forEach(function(fill) {
    const targetWidth = fill.style.width;
    fill.style.width = '0%';
    setTimeout(function() {
      fill.style.width = targetWidth;
    }, 400);
  });

  // Auto-hide alerts
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(function(alert) {
    setTimeout(function() {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.5s';
      setTimeout(function() { alert.remove(); }, 500);
    }, 4000);
  });

  // Active nav item in popup
  const currentPath = window.location.pathname;
  const popupItems = document.querySelectorAll('.popup-item');
  popupItems.forEach(function(item) {
    if (item.getAttribute('href') === currentPath) {
      item.style.color = 'var(--gold)';
      item.style.background = 'var(--gold-pale)';
    }
  });
});

// OTP INPUT — auto focus next box
document.querySelectorAll('.otp-input').forEach(function(input, i, inputs) {
  input.addEventListener('input', function() {
    if (this.value.length === 1 && inputs[i + 1]) {
      inputs[i + 1].focus();
    }
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' && !this.value && inputs[i - 1]) {
      inputs[i - 1].focus();
    }
  });
});

// PASSWORD SHOW/HIDE
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
    btn.style.color = 'var(--gold)';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
    btn.style.color = '';
  }
}

/* ── KAIZEN streaming helper ─────────────────────────────────────
   POST JSON to `url`; when the server answers with an SSE stream the
   handlers fire as text arrives: onMeta, onDelta, onDone, onError.
   A plain JSON response goes to onJson instead (graceful fallback).
   Shared by the Psychology chat, the KAIZEN AI chat, and the Reflect
   analysis reveal. No jQuery, no dependencies. */
window.kaizenStream = function (url, body, h) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin'
  }).then(function (res) {
    var ct = res.headers.get('Content-Type') || '';
    if (ct.indexOf('text/event-stream') < 0 || !res.body || !res.body.getReader) {
      return res.json().then(function (data) { if (h.onJson) h.onJson(data); },
                             function () { if (h.onError) h.onError('Bad response.'); });
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    function handleEvent(raw) {
      var payload;
      try { payload = JSON.parse(raw); } catch (e) { return; }
      if (payload.type === 'meta' && h.onMeta) h.onMeta(payload);
      else if (payload.type === 'delta' && h.onDelta) h.onDelta(payload.text || '');
      else if (payload.type === 'done' && h.onDone) h.onDone(payload);
      else if (payload.type === 'error' && h.onError) h.onError(payload.error);
    }
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) { if (h.onDone) h.onDone(); return; }
        buf += dec.decode(r.value, { stream: true });
        var parts = buf.split('\n\n');
        buf = parts.pop();
        for (var i = 0; i < parts.length; i++) {
          var lines = parts[i].split('\n');
          for (var j = 0; j < lines.length; j++) {
            if (lines[j].indexOf('data:') === 0) handleEvent(lines[j].slice(5).trim());
          }
        }
        return pump();
      });
    }
    return pump();
  });
};
