import { api } from "./util.js";

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const errLogin = document.getElementById("err-login");
const errRegister = document.getElementById("err-register");
const emailLogin = document.getElementById("email-login");
const passLogin = document.getElementById("pass-login");
const emailReg = document.getElementById("email-register");
const passReg = document.getElementById("pass-register");
const passReg2 = document.getElementById("pass-register2");

function safeNextPath(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const p = raw.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  if (p.includes("..")) return null;
  return p;
}

function getNextUrl() {
  const q = new URLSearchParams(window.location.search).get("next");
  return safeNextPath(q);
}

function showErr(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function setMode(mode) {
  const isLogin = mode === "login";
  if (formLogin) formLogin.classList.toggle("hidden", !isLogin);
  if (formRegister) formRegister.classList.toggle("hidden", isLogin);
  if (tabLogin) {
    tabLogin.classList.toggle("bg-white", isLogin);
    tabLogin.classList.toggle("text-foreground", isLogin);
    tabLogin.classList.toggle("shadow-sm", isLogin);
    tabLogin.classList.toggle("text-muted-foreground", !isLogin);
  }
  if (tabRegister) {
    tabRegister.classList.toggle("bg-white", !isLogin);
    tabRegister.classList.toggle("text-foreground", !isLogin);
    tabRegister.classList.toggle("shadow-sm", !isLogin);
    tabRegister.classList.toggle("text-muted-foreground", isLogin);
  }
  showErr(errLogin, "");
  showErr(errRegister, "");
}

function redirectAfterAuth(role) {
  const next = getNextUrl();
  if (next) {
    window.location.href = next;
    return;
  }
  if (role === "admin") {
    window.location.href = "/admin";
    return;
  }
  window.location.href = "/minha-conta.html";
}

tabLogin?.addEventListener("click", () => setMode("login"));
tabRegister?.addEventListener("click", () => setMode("register"));

formLogin?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr(errLogin, "");
  showErr(errRegister, "");
  const email = String(emailLogin?.value || "").trim();
  const password = String(passLogin?.value || "");
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    redirectAfterAuth(data.role);
  } catch (err) {
    showErr(errLogin, err.message || "Não foi possível entrar.");
  }
});

formRegister?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr(errRegister, "");
  showErr(errLogin, "");
  const email = String(emailReg?.value || "").trim();
  const password = String(passReg?.value || "");
  const password2 = String(passReg2?.value || "");
  if (password !== password2) {
    showErr(errRegister, "As senhas não coincidem.");
    return;
  }
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    redirectAfterAuth(data.role);
  } catch (err) {
    showErr(errRegister, err.message || "Não foi possível criar a conta.");
  }
});

(async function init() {
  try {
    const { user } = await api("/api/me");
    if (user) redirectAfterAuth(user.role);
  } catch {
    /* offline / erro: mostrar formulário */
  }
  setMode("login");
})();
