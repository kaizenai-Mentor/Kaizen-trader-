// ── KAIZEN CLIENT JS ──

// THEME
const savedTheme = localStorage.getItem('kaizen-theme') ||
  (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('kaizen-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '◑' : '◐';
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
