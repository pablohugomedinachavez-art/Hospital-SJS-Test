// Simple toast utility (no dependencies)
function ensureContainer() {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

export function showToast(message, type = 'success', title = '') {
  try {
    const container = ensureContainer();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    if (title) {
      const h = document.createElement('div');
      h.className = 'title';
      h.textContent = title;
      t.appendChild(h);
    }
    const m = document.createElement('div');
    m.className = 'message';
    m.textContent = message;
    t.appendChild(m);

    container.appendChild(t);
    // allow CSS animation frame
    requestAnimationFrame(() => t.classList.add('show'));

    const timeout = 4200;
    const remove = () => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 220);
    };
    const timerId = setTimeout(remove, timeout);

    t.addEventListener('click', () => {
      clearTimeout(timerId);
      remove();
    });
  } catch (err) {
    // fallback: console
    console.warn('showToast error', err);
  }
}

export default showToast;
