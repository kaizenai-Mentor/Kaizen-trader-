// Kaizen — Client Side JS

// Animate discipline score bar on load
document.addEventListener('DOMContentLoaded', () => {

  // Score bar animation
  const scoreFill = document.querySelector('.score-fill');
  if (scoreFill) {
    const width = scoreFill.style.width;
    scoreFill.style.width = '0%';
    setTimeout(() => {
      scoreFill.style.width = width;
    }, 300);
  }

  // Auto-hide alerts after 4 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.5s ease';
      setTimeout(() => alert.remove(), 500);
    }, 4000);
  });

  // Active nav link highlight
  const navLinks = document.querySelectorAll('.nav-links a');
  const currentPath = window.location.pathname;
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.style.color = '#C9A84C';
    }
  });

});