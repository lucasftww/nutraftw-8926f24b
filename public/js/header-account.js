const ICON_USER = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-user-round w-5 h-5" aria-hidden="true"><path d="M18 20a6 6 0 0 0-12 0"></path><circle cx="12" cy="10" r="4"></circle><circle cx="12" cy="12" r="10"></circle></svg>`;

const DESKTOP_BTN =
  "hidden md:inline-flex items-center gap-2 h-10 md:h-11 px-3 md:px-4 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold text-sm transition-colors";

async function renderHeaderAuth() {
  const desktop = document.getElementById("header-auth-desktop");
  const mobile = document.getElementById("header-auth-mobile");
  if (!desktop && !mobile) return;

  let user = null;
  try {
    const data = await fetch("/api/me", { credentials: "same-origin" }).then(
      (r) => (r.ok ? r.json() : null)
    );
    user = data && data.user ? data.user : null;
  } catch {
    user = null;
  }

  let desktopHtml = "";
  let mobileHtml = "";

  if (user?.role === "admin") {
    desktopHtml = `<a href="/admin" class="${DESKTOP_BTN}">${ICON_USER}Admin</a>`;
    mobileHtml = `<a href="/admin" class="font-semibold text-primary">Admin</a>`;
  } else if (user?.email) {
    desktopHtml = `<a href="/minha-conta.html" class="${DESKTOP_BTN}">${ICON_USER}Minha conta</a>`;
    mobileHtml = `<a href="/minha-conta.html" class="font-semibold text-primary">Minha conta</a>`;
  } else {
    desktopHtml = `<a href="/login" class="${DESKTOP_BTN}">${ICON_USER}Entrar</a>`;
    mobileHtml = `<a href="/login" class="font-semibold text-primary">Entrar</a>`;
  }

  if (desktop) desktop.innerHTML = desktopHtml;
  if (mobile) mobile.innerHTML = mobileHtml;
}

void renderHeaderAuth();
