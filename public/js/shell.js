(function () {
  const btn = document.getElementById("nav-menu-btn");
  const drawer = document.getElementById("mobile-drawer");
  if (!btn || !drawer) return;

  function setOpen(open) {
    drawer.classList.toggle("is-open", !!open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  btn.addEventListener("click", () => {
    const open = !drawer.classList.contains("is-open");
    setOpen(open);
  });

  drawer.querySelectorAll("[data-close-drawer]").forEach((el) => {
    el.addEventListener("click", () => setOpen(false));
  });
  drawer.querySelectorAll("nav a").forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });
})();
