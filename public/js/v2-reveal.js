/* KAIZEN V2 reveal system — config/Design.js §9.
   No libraries. One IntersectionObserver + CSS transitions.
   - Adds .k-anim to <html> (enables hidden reveal states; no-JS users
     see everything immediately).
   - [data-reveal] elements fade up once when scrolled into view.
   - .k-dial arcs and .k-meter fills animate to their data-value when
     their container reveals.
   Honors prefers-reduced-motion: instruments render final state,
     transitions are disabled in CSS. */
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setDial(d) {
    var v = parseFloat(d.getAttribute('data-dial'));
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(100, v));
    var arc = d.querySelector('.k-dial-arc');
    if (arc) arc.style.strokeDashoffset = (339.292 * (1 - v / 100)).toFixed(2);
  }

  function setMeter(m) {
    var v = parseFloat(m.getAttribute('data-meter'));
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(100, v));
    var fill = m.querySelector('.k-meter-fill');
    if (fill) fill.style.width = v + '%';
  }

  function arm(scope) {
    scope.querySelectorAll('.k-dial').forEach(setDial);
    scope.querySelectorAll('.k-meter').forEach(setMeter);
  }

  document.documentElement.classList.add('k-anim');

  if (reduce || !('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('is-in');
    });
    arm(document);
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      arm(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    io.observe(el);
  });
})();
