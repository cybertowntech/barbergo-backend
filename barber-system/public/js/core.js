/* ============================================================
   BARBER GO — CORE FRONTEND SCRIPT
   Loader, Lenis smooth scroll, GSAP reveals, nav, cursor, magnetic btns
   Expects: GSAP + ScrollTrigger + Lenis loaded via CDN before this file
   ============================================================ */

(function () {
  'use strict';

  /* ---------- LOADER ---------- */
  function runLoader(onDone) {
    const loader = document.getElementById('loader');
    if (!loader) { onDone && onDone(); return; }
    const fill = loader.querySelector('.loader-bar-fill');
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(loader, {
          yPercent: -100,
          duration: 0.9,
          ease: 'power4.inOut',
          onComplete: () => { loader.style.display = 'none'; onDone && onDone(); }
        });
      }
    });
    tl.to(fill, { width: '100%', duration: 1.1, ease: 'power2.inOut' });
  }

  /* ---------- LENIS SMOOTH SCROLL ---------- */
  let lenis;
  function initLenis() {
    if (typeof Lenis === 'undefined') return;
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }

  /* ---------- HEADER SCROLL STATE ---------- */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- FULLSCREEN NAV OVERLAY ---------- */
  function initNavOverlay() {
    const burger = document.querySelector('.hamburger');
    const overlay = document.querySelector('.nav-overlay');
    if (!burger || !overlay) return;
    const links = overlay.querySelectorAll('.nav-overlay-links a span');

    function openNav() {
      burger.classList.add('active');
      overlay.classList.add('active');
      if (lenis) lenis.stop();
      gsap.fromTo(links, { yPercent: 110 }, {
        yPercent: 0, duration: 0.9, stagger: 0.06, ease: 'power4.out', delay: 0.15
      });
    }
    function closeNav() {
      burger.classList.remove('active');
      overlay.classList.remove('active');
      if (lenis) lenis.start();
    }
    burger.addEventListener('click', () => {
      burger.classList.contains('active') ? closeNav() : openNav();
    });
    overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
  }

  /* ---------- MAGNETIC BUTTONS ---------- */
  function initMagnetic() {
    document.querySelectorAll('.magnetic').forEach((el) => {
      const strength = 0.35;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        gsap.to(el, { x: x * strength, y: y * strength, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* ---------- CUSTOM CURSOR ---------- */
  function initCursor() {
    const dot = document.querySelector('.cursor-dot');
    if (!dot) return;
    window.addEventListener('mousemove', (e) => {
      gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0.15, ease: 'power2.out' });
    });
    document.querySelectorAll('a, button, .card').forEach(el => {
      el.addEventListener('mouseenter', () => gsap.to(dot, { scale: 2.4, duration: 0.3 }));
      el.addEventListener('mouseleave', () => gsap.to(dot, { scale: 1, duration: 0.3 }));
    });
  }

  /* ---------- TEXT SPLIT REVEAL (per word) ---------- */
  function splitWords(el) {
    const text = el.textContent;
    el.innerHTML = text.split(' ').map(w => `<span class="word"><span class="word-inner">${w}</span></span>`).join(' ');
  }

  function initTextReveal() {
    document.querySelectorAll('[data-reveal-text]').forEach((el) => {
      splitWords(el);
      gsap.set(el.querySelectorAll('.word-inner'), { yPercent: 110 });
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(el.querySelectorAll('.word-inner'), {
            yPercent: 0, duration: 1, stagger: 0.03, ease: 'power4.out'
          });
        }
      });
    });
  }

  /* ---------- GENERIC SCROLL REVEAL ---------- */
  function initScrollReveals() {
    gsap.utils.toArray('.reveal').forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, y: 40, filter: 'blur(8px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        }
      );
    });

    gsap.utils.toArray('.reveal-stagger').forEach((group) => {
      const items = group.children;
      gsap.fromTo(items,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: group, start: 'top 85%', once: true }
        }
      );
    });
  }

  /* ---------- PARALLAX ---------- */
  function initParallax() {
    gsap.utils.toArray('[data-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.3;
      gsap.to(el, {
        yPercent: speed * 100,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ---------- ANIMATED GRADIENT BLOB (canvas-free, CSS-driven via JS vars) ---------- */
  function initGradientBlobs() {
    document.querySelectorAll('.gradient-blob').forEach((blob, i) => {
      gsap.to(blob, {
        x: () => gsap.utils.random(-60, 60),
        y: () => gsap.utils.random(-40, 40),
        duration: () => gsap.utils.random(6, 10),
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * 0.5
      });
    });
  }

  /* ---------- FLOATING ELEMENTS ---------- */
  function initFloating() {
    document.querySelectorAll('[data-float]').forEach((el, i) => {
      gsap.to(el, {
        y: -16, duration: 2.4 + i * 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut'
      });
    });
  }

  /* ---------- CART (booking selection) BADGE SYNC ---------- */
  function initCartBadge() {
    const badge = document.querySelector('.cart-badge');
    if (!badge) return;
    function update() {
      const cart = JSON.parse(localStorage.getItem('bg_cart') || 'null');
      const count = cart && cart.service ? 1 : 0;
      badge.textContent = count;
      badge.style.display = count ? 'flex' : 'none';
    }
    update();
    window.addEventListener('storage', update);
    window.addEventListener('bg_cart_updated', update);
  }

  /* ---------- INIT ALL ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    runLoader(() => {
      initScrollReveals();
      if (typeof gsap !== 'undefined') initTextReveal();
      initParallax();
    });

    initLenis();
    initHeaderScroll();
    initNavOverlay();
    initMagnetic();
    initCursor();
    initGradientBlobs();
    initFloating();
    initCartBadge();
  });

  window.BarberGo = window.BarberGo || {};
  window.BarberGo.getLenis = () => lenis;
})();
