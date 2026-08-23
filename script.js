/* ===== Navigation ===== */
const nav = document.getElementById('nav');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = nav.querySelectorAll('a');
const views = document.querySelectorAll('.view');

// Mobile menu toggle
menuToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', isOpen);
});

// Tab navigation
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetView = link.dataset.view;

    // Update active nav link
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // Show target view
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${targetView}`).classList.add('active');

    // Close mobile menu
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// Handle hash links in hero and other sections
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const targetId = this.getAttribute('href').substring(1);
    const targetLink = nav.querySelector(`a[data-view="${targetId}"]`);
    if (targetLink) {
      e.preventDefault();
      targetLink.click();
    }
  });
});

/* ===== Lightbox ===== */
const lightbox = document.getElementById('lightbox');

document.querySelectorAll('.thumb-wrap').forEach(wrap => {
  wrap.addEventListener('click', () => {
    const img = wrap.querySelector('img');
    if (img) {
      lightbox.innerHTML = `<img src="${img.src}" alt="${img.alt}">`;
      lightbox.classList.add('open');
    }
  });
});

lightbox.addEventListener('click', () => {
  lightbox.classList.remove('open');
  lightbox.innerHTML = '';
});

// Close lightbox with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightbox.classList.contains('open')) {
    lightbox.classList.remove('open');
    lightbox.innerHTML = '';
  }
});

/* ===== Intersection Observer for animations ===== */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.cell, .about-content, .contact-content').forEach(el => {
  observer.observe(el);
});
