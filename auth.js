(function () {
  const USERS_KEY = "teerapatUsers";
  const AUTH_KEY = "teerapatAuth";

  function loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch (error) {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function ensureSeedUsers() {
    const users = loadUsers();
    if (users.length === 0) {
      saveUsers([
        { name: "Admin", email: "admin@teerapatnews.com", password: "123456" }
      ]);
    }
    return loadUsers();
  }

  function normalizeUser(user) {
    if (!user || !user.email) return null;

    const email = String(user.email).trim().toLowerCase();
    return {
      ...user,
      email,
      name: user.name || "User",
      role: user.role || (email === "admin@teerapatnews.com" ? "admin" : "user")
    };
  }

  function getAuthUser() {
    try {
      const raw = localStorage.getItem(AUTH_KEY) || localStorage.getItem("user");
      if (!raw) return null;
      return normalizeUser(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function setAuthUser(user) {
    const normalized = normalizeUser(user);
    if (!normalized) return;

    localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
    localStorage.setItem("user", JSON.stringify(normalized));
  }

  function clearAuthUser() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem("user");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function renderAuthActions() {
    const roots = document.querySelectorAll("[data-auth-root]");
    const currentUser = getAuthUser();

    roots.forEach((root) => {
      if (currentUser) {
        root.innerHTML = `
          <span class="auth-user">👋 ${escapeHtml(currentUser.name)}</span>
          <a href="#" class="auth-btn auth-btn-muted" onclick="event.preventDefault(); window.teerapatAuth.logout();">ออกจากระบบ</a>
        `;
      } else {
        root.innerHTML = `
          <a href="login.html" class="auth-btn auth-btn-primary">เข้าสู่ระบบ</a>
          <a href="signup.html" class="auth-btn auth-btn-outline">สมัครสมาชิก</a>
        `;
      }
    });
  }

  function registerUser(payload) {
    const users = ensureSeedUsers();
    const normalized = {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password
    };

    if (!normalized.name || !normalized.email || !normalized.password) {
      return { ok: false, message: "กรุณากรอกข้อมูลให้ครบทุกช่อง" };
    }

    if (normalized.password.length < 4) {
      return { ok: false, message: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" };
    }

    if (users.some((user) => user.email === normalized.email)) {
      return { ok: false, message: "อีเมลนี้ถูกใช้แล้ว" };
    }

    users.push(normalized);
    saveUsers(users);

    const user = {
      name: normalized.name,
      email: normalized.email,
      role: normalized.email === "admin@teerapatnews.com" ? "admin" : "user"
    };

    setAuthUser(user);
    return { ok: true, message: "สมัครสมาชิกสำเร็จ", user };
  }

  function loginUser(payload) {
    const users = ensureSeedUsers();
    const normalized = {
      email: payload.email.trim().toLowerCase(),
      password: payload.password
    };

    if (!normalized.email || !normalized.password) {
      return { ok: false, message: "กรุณากรอกอีเมลและรหัสผ่าน" };
    }

    const match = users.find((user) => user.email === normalized.email && user.password === normalized.password);
    if (!match) {
      return { ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    }

    const user = {
      name: match.name,
      email: match.email,
      role: match.email === "admin@teerapatnews.com" ? "admin" : "user"
    };

    setAuthUser(user);
    return { ok: true, message: "เข้าสู่ระบบสำเร็จ", user };
  }

  function logout() {
    clearAuthUser();
    renderAuthActions();
    window.location.href = "login.html";
  }

  function redirectIfNeeded() {
    const path = window.location.pathname.split("/").pop();
    const user = getAuthUser();
    if ((path === "login.html" || path === "signup.html") && user) {
      window.location.href = user.role === "admin" ? "admin.html" : "index.html";
    }
  }

  window.teerapatAuth = {
    registerUser,
    loginUser,
    logout,
    getAuthUser,
    renderAuthActions
  };

  document.addEventListener("DOMContentLoaded", () => {
    redirectIfNeeded();
    renderAuthActions();
  });
})();
