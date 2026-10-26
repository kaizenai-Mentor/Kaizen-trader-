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

/* ── KAIZEN Branded Selection Menu (progressive enhancement for <select>) ──
   Replaces the unstyled native OS dropdown popup with a branded KAIZEN
   menu (Crispy Black #0A0A0A, Ocean White #F4F8FB, Electric Gold #F5C518,
   Burnt Blue #1A2F4A hover) while keeping the underlying <select> synced
   so form posts and change listeners continue to work identically. */
function initBrandedSelects() {
  var selects = document.querySelectorAll('select:not([data-k-select-ready])');
  selects.forEach(function (sel) {
    sel.setAttribute('data-k-select-ready', '1');
    var wrap = document.createElement('div');
    wrap.className = 'k-select-wrap';
    if (sel.style && sel.style.width) wrap.style.width = sel.style.width;
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('k-select-native');

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'k-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    var labelSpan = document.createElement('span');
    labelSpan.className = 'k-select-label';
    var arrowSpan = document.createElement('span');
    arrowSpan.className = 'k-select-arrow';
    arrowSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="#F5C518" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowSpan);

    var menu = document.createElement('div');
    menu.className = 'k-select-menu';
    menu.setAttribute('role', 'listbox');

    function rebuildOptions() {
      menu.innerHTML = '';
      var selectedOpt = sel.options[sel.selectedIndex] || sel.options[0];
      labelSpan.textContent = selectedOpt ? selectedOpt.textContent : '';
      Array.prototype.forEach.call(sel.options, function (opt, idx) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'k-select-option' + (idx === sel.selectedIndex ? ' is-selected' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', idx === sel.selectedIndex ? 'true' : 'false');
        if (opt.disabled) item.disabled = true;
        item.textContent = opt.textContent;
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          if (opt.disabled) return;
          sel.selectedIndex = idx;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          rebuildOptions();
          closeMenu();
        });
        menu.appendChild(item);
      });
    }

    function openMenu() {
      document.querySelectorAll('.k-select-wrap.is-open').forEach(function (w) {
        if (w !== wrap) {
          w.classList.remove('is-open');
          var t = w.querySelector('.k-select-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (sel.disabled) return;
      if (wrap.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    sel.addEventListener('change', rebuildOptions);
    rebuildOptions();
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
  });
}

document.addEventListener('DOMContentLoaded', initBrandedSelects);
document.addEventListener('click', function () {
  document.querySelectorAll('.k-select-wrap.is-open').forEach(function (w) {
    w.classList.remove('is-open');
    var t = w.querySelector('.k-select-trigger');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
});

