function getStoredUser() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function getUserRole(user) {
  if (!user || !user.email) return 'guest';
  return user.role || (user.email.toLowerCase() === 'admin@teerapatnews.com' ? 'admin' : 'user');
}

function hydrateNavbar() {
  const authActions = document.getElementById('nav-auth-actions');
  const navLinks = document.getElementById('nav-links');
  if (!authActions || !navLinks) return;

  const user = getStoredUser();
  const role = getUserRole(user);
  const themeButton = '<button id="nav-theme-toggle" class="icon-button" type="button" aria-label="Toggle dark mode">Dark</button>';

  if (!user) {
    authActions.innerHTML = `${themeButton}<a class="button secondary" href="login.html">เข้าสู่ระบบ</a><a class="button primary" href="signup.html">สมัคร</a>`;
    return;
  }

  authActions.innerHTML = `${themeButton}<a class="button secondary" href="profile.html">โปรไฟล์</a>${role === 'admin' ? '<a class="button secondary" href="admin.html" id="nav-admin-link">Admin</a>' : ''}<a class="button" href="#" id="nav-logout">ออกจากระบบ</a>`;

  if (role === 'admin' && !navLinks.querySelector('a[href="admin.html"]')) {
    navLinks.insertAdjacentHTML('beforeend', '<a href="admin.html">Admin</a>');
  }

  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (event) => {
      event.preventDefault();
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    });
  }
}

function loadNavbar() {
  return fetch('navbar.html')
    .then((response) => response.text())
    .then((html) => {
      const container = document.getElementById('navbar-container');
      if (!container) return;
      container.innerHTML = html;
      hydrateNavbar();
    })
    .catch((error) => console.error('Error loading navbar:', error));
}

document.addEventListener('DOMContentLoaded', loadNavbar);
