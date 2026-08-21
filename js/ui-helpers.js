/* ========================================================
   CRUD 2026 — UI HELPERS & MOBILE MENU CONTROLLER
   ======================================================== */

// Universal HTML Escape Sanitizer
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenuToggle();
});

// Mobile Hamburger Menu Handler
function setupMobileMenuToggle() {
  const navContainers = document.querySelectorAll('.nav-container');
  
  navContainers.forEach(container => {
    const navLinks = container.querySelector('.nav-links');
    if (!navLinks) return;

    // Check if toggle button already exists
    let toggleBtn = container.querySelector('.mobile-menu-toggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.className = 'mobile-menu-toggle';
      toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
      toggleBtn.innerHTML = '☰';
      container.appendChild(toggleBtn);
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = navLinks.classList.toggle('active');
      toggleBtn.innerHTML = isActive ? '✕' : '☰';
    });

    // Close menu when a link inside is clicked
    const links = navLinks.querySelectorAll('a, button');
    links.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        toggleBtn.innerHTML = '☰';
      });
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-links.active').forEach(navLinks => {
      if (!navLinks.contains(e.target)) {
        navLinks.classList.remove('active');
        const container = navLinks.closest('.nav-container');
        if (container) {
          const toggleBtn = container.querySelector('.mobile-menu-toggle');
          if (toggleBtn) toggleBtn.innerHTML = '☰';
        }
      }
    });
  });
}

// Toast Notifications
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `
    <span style="font-weight: bold;">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Button Loading State
function setButtonLoading(buttonEl, isLoading, loadingText = 'Processing...') {
  if (!buttonEl) return;

  if (isLoading) {
    buttonEl.dataset.originalText = buttonEl.innerHTML;
    buttonEl.disabled = true;
    buttonEl.innerHTML = `
      <div class="spinner"></div>
      <span>${loadingText}</span>
    `;
  } else {
    buttonEl.disabled = false;
    if (buttonEl.dataset.originalText) {
      buttonEl.innerHTML = buttonEl.dataset.originalText;
    }
  }
}

// Mask Email Utility (e.g., r*****@gmail.com)
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  const maskedName = name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

// Toggle Password Visibility (Eye Button)
function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btnEl) btnEl.innerHTML = '🙈';
  } else {
    input.type = 'password';
    if (btnEl) btnEl.innerHTML = '👁️';
  }
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// Format Date
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

window.showToast = showToast;
window.setButtonLoading = setButtonLoading;
window.maskEmail = maskEmail;
window.togglePasswordVisibility = togglePasswordVisibility;
window.openModal = openModal;
window.closeModal = closeModal;
window.formatDate = formatDate;
