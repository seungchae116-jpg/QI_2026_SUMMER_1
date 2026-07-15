const API_BASE = "https://qi-2026-summer-1-api.onrender.com";
const TOKEN_KEY = "avomatic_token";

const FAVORITE_STYLES = [
  { key: "unripe", label: "미숙", emoji: "🥑" },
  { key: "breaking", label: "브레이킹", emoji: "🥑" },
  { key: "ripe1", label: "적숙 1단계", emoji: "🥑" },
  { key: "ripe2", label: "적숙 2단계", emoji: "🥑" },
  { key: "overripe", label: "과숙", emoji: "🫒" },
];

const navAccountLink = document.getElementById("navAccountLink");
const loggedOutView = document.getElementById("authLoggedOut");
const loggedInView = document.getElementById("authLoggedIn");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const profileEmail = document.getElementById("profileEmail");
const logoutBtn = document.getElementById("logoutBtn");
const favoriteStyleGroup = document.getElementById("favoriteStyleGroup");
const favoriteSaved = document.getElementById("favoriteSaved");

document.querySelectorAll(".account-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".account-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.classList.toggle("hidden", !isLogin);
    signupForm.classList.toggle("hidden", isLogin);
  });
});

favoriteStyleGroup.innerHTML = FAVORITE_STYLES.map(
  (s) => `<button class="pill" type="button" data-style="${s.key}">${s.emoji} ${s.label}</button>`
).join("");

favoriteStyleGroup.addEventListener("click", async (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  try {
    await saveFavoriteStyle(btn.dataset.style);
    markActiveStyle(btn.dataset.style);
    favoriteSaved.classList.remove("hidden");
    setTimeout(() => favoriteSaved.classList.add("hidden"), 1800);
  } catch (err) {
    console.error(err);
  }
});

function markActiveStyle(styleKey) {
  favoriteStyleGroup.querySelectorAll(".pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.style === styleKey);
  });
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했어요");
  return data;
}

async function saveFavoriteStyle(styleKey) {
  await apiFetch("/api/me/favorite-style", {
    method: "PUT",
    body: JSON.stringify({ style: styleKey }),
  });
}

function showLoggedIn(user) {
  loggedOutView.classList.add("hidden");
  loggedInView.classList.remove("hidden");
  profileEmail.textContent = user.email;
  navAccountLink.textContent = "내 계정";
  if (user.favorite_style) markActiveStyle(user.favorite_style);
}

function showLoggedOut() {
  loggedOutView.classList.remove("hidden");
  loggedInView.classList.add("hidden");
  navAccountLink.textContent = "로그인";
}

async function refreshProfile() {
  if (!getToken()) {
    showLoggedOut();
    return;
  }
  try {
    const user = await apiFetch("/api/me");
    showLoggedIn(user);
  } catch {
    clearToken();
    showLoggedOut();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  try {
    const { token, user } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value,
      }),
    });
    setToken(token);
    showLoggedIn(user);
    loginForm.reset();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.classList.add("hidden");
  try {
    const { token, user } = await apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("signupName").value,
        email: document.getElementById("signupEmail").value,
        password: document.getElementById("signupPassword").value,
      }),
    });
    setToken(token);
    showLoggedIn(user);
    signupForm.reset();
  } catch (err) {
    signupError.textContent = err.message;
    signupError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  showLoggedOut();
});

refreshProfile();
