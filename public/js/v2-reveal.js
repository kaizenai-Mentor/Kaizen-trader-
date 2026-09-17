/**
 * KAIZEN V2 — reveal animations.
 * Animates instrument fills (k-meter, k-milestone-fill) from their
 * data-meter attributes once they scroll into view. Respects
 * prefers-reduced-motion: fills render instantly, no animation.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fill(el) {
    var v = parseFloat(el.getAttribute('data-meter'));
    if (isNaN(v)) v = 0;
    var w = Math.max(0, Math.min(100, v)) + '%';
    // data-meter lives on the .k-meter ROW; the visible bar is the
    // .k-meter-fill child inside the track. (.k-milestone-fill carries
    // data-meter on itself.)
    var target = el.classList.contains('k-meter')
      ? el.querySelector('.k-meter-fill')
      : el;
    if (target) target.style.width = w;
  }

  function reveal() {
    var els = document.querySelectorAll('.k-meter[data-meter], .k-milestone-fill[data-meter]');
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(fill);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          fill(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal);
  } else {
    reveal();
  }
})();
