/* Shield — scroll-reveal helper
 * Adds .is-visible to [data-reveal] elements when they enter the viewport.
 * Used by components.css to fade+rise elements on first view.
 */
(function () {
  if (!('IntersectionObserver' in window)) {
    // Fallback: reveal everything immediately
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  const reveal = () => document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(el => observer.observe(el));
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal);
  } else {
    reveal();
  }
})();
