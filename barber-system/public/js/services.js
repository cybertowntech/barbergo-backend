/* ============================================================
   SERVICES PAGE LOGIC
   ============================================================ */

(function () {
  let allServices = [];
  let currentFilter = 'all';

  async function loadServices() {
    try {
      allServices = await API.services.list();
      render();
    } catch (err) {
      document.getElementById('servicesGrid').innerHTML =
        '<p class="muted">Gagal memuatkan servis. Sila cuba lagi.</p>';
    }
  }

  function render() {
    const grid = document.getElementById('servicesGrid');
    const empty = document.getElementById('emptyState');

    const filtered = currentFilter === 'all'
      ? allServices
      : allServices.filter(s => s.category === currentFilter);

    if (!filtered.length) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = filtered.map(s => `
      <div class="service-item reveal" data-id="${s.id}">
        <div class="service-item-top">
          <span class="service-cat-tag">${s.category}</span>
        </div>
        <h3>${s.name}</h3>
        <div class="service-item-bottom">
          <span class="service-price">RM${Number(s.price).toFixed(0)}</span>
          <button class="add-btn" data-add="${s.id}" aria-label="Tambah">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Re-run reveal animation for newly injected cards
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(grid.querySelectorAll('.service-item'),
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out' }
      );
    }

    grid.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => addToCart(btn.dataset.add));
    });
  }

  function addToCart(serviceId) {
    const service = allServices.find(s => String(s.id) === String(serviceId));
    if (!service) return;

    if (service.type === 'addon') {
      // Addons go straight to booking page cart as pending addon
      const cart = JSON.parse(localStorage.getItem('bg_cart') || '{}');
      cart.pendingAddon = service;
      localStorage.setItem('bg_cart', JSON.stringify(cart));
      window.location.href = '/booking.html';
      return;
    }

    const cart = { service, addons: [] };
    localStorage.setItem('bg_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('bg_cart_updated'));
    window.location.href = '/booking.html';
  }

  function initFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.category;
        render();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadServices();
    initFilters();
  });
})();
