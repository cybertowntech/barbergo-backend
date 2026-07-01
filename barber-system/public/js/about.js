/* ============================================================
   ABOUT PAGE — STAT COUNTER ANIMATION
   ============================================================ */

(function () {
  function initCounters() {
    const stats = document.querySelectorAll('.stat-num');
    if (!stats.length || typeof gsap === 'undefined') return;

    stats.forEach((el) => {
      const target = parseInt(el.dataset.count, 10);
      const obj = { val: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () => {
          gsap.to(obj, {
            val: target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => { el.textContent = Math.round(obj.val); }
          });
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCounters, 100); // let ScrollTrigger register after core.js init
  });
})();
