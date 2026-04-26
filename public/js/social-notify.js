import { api } from "./util.js";

/** Cidades BR — linha com ícone de localização (estilo referência) */
const CITIES = [
  "Duque de Caxias",
  "São Paulo",
  "Rio de Janeiro",
  "Belo Horizonte",
  "Curitiba",
  "Porto Alegre",
  "Brasília",
  "Salvador",
  "Fortaleza",
  "Recife",
  "Manaus",
  "Belém",
  "Goiânia",
  "Campinas",
  "São Luís",
  "Maceió",
  "Natal",
  "João Pessoa",
  "Aracaju",
  "Vitória",
  "Florianópolis",
  "Santos",
  "Guarulhos",
  "Osasco",
  "Ribeirão Preto",
  "Sorocaba",
  "Niterói",
  "Nova Iguaçu",
];

const FIRST_NAMES = [
  "Alexandre",
  "Ana",
  "Beatriz",
  "Carlos",
  "Daniel",
  "Eduarda",
  "Felipe",
  "Gabriel",
  "Helena",
  "Igor",
  "Julia",
  "Kaue",
  "Larissa",
  "Marcos",
  "Natalia",
  "Otavio",
  "Paula",
  "Rafael",
  "Sara",
  "Thiago",
  "Vanessa",
  "Yuri",
  "Amanda",
  "Bruno",
  "Camila",
  "Diego",
  "Fernanda",
  "Gustavo",
  "Isabela",
  "João",
  "Lucas",
  "Mariana",
  "Pedro",
  "Renata",
];

let started = false;

const queue = [];
let showing = false;

const BAG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></svg>`;

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nome exibido como na referência: primeiro nome + *** */
function randomBuyerLabel() {
  return `${pick(FIRST_NAMES)}***`;
}

/**
 * @param {{ firstNameLabel: string; product: string; city: string; durationMs?: number }} data
 */
function notify(data) {
  queue.push({
    firstNameLabel: data.firstNameLabel,
    product: data.product,
    city: data.city,
    durationMs:
      typeof data.durationMs === "number" && Number.isFinite(data.durationMs)
        ? data.durationMs
        : 2800,
  });
  processQueue();
}

function toastHtml(item) {
  const name = esc(item.firstNameLabel);
  const prod = esc(item.product);
  const city = esc(item.city);
  return `
<button type="button" class="notify-close" aria-label="Fechar notificação">${CLOSE_SVG}</button>
<div class="notify-main">
  <div class="notify-icon-wrap">${BAG_SVG}</div>
  <div class="notify-body">
    <div class="notify-line1">
      <span class="notify-name">${name}</span>
      <span class="notify-muted-inline"> acabou de</span>
    </div>
    <div class="notify-line2">comprar</div>
    <div class="notify-product">${prod}</div>
    <div class="notify-line-loc">${PIN_SVG}<span>${city}</span></div>
  </div>
</div>
<div class="notify-progress" aria-hidden="true">
  <span class="notify-progress-fill"></span>
</div>`;
}

/** Próximo frame duplo — garante que o browser aplicou layout antes da transição de entrada */
function raf2(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

function processQueue() {
  if (showing || queue.length === 0) return;

  showing = true;
  const item = queue.shift();
  const root = document.getElementById("notify-root");
  if (!root || !item) {
    showing = false;
    processQueue();
    return;
  }

  const el = document.createElement("div");
  el.className = "notify";
  el.setAttribute("aria-hidden", "true");
  el.style.setProperty("--notify-duration", `${item.durationMs}ms`);
  el.innerHTML = toastHtml(item);
  root.appendChild(el);

  const progressFill = el.querySelector(".notify-progress-fill");
  /** Evita que animationend da barra suba até .notify e dispare lógica errada */
  progressFill?.addEventListener("animationend", (e) => {
    e.stopPropagation();
  });

  let dismissed = false;
  let exiting = false;
  let dismissTimer = 0;

  const cleanup = () => {
    if (dismissed) return;
    dismissed = true;
    window.clearTimeout(dismissTimer);
    el.removeEventListener("transitionend", onTransitionEnd);
    el.remove();
    showing = false;
    processQueue();
  };

  const onTransitionEnd = (e) => {
    if (e.target !== el) return;
    if (!el.classList.contains("is-leaving")) return;
    const ok =
      e.propertyName === "opacity" || e.propertyName === "transform";
    if (!ok) return;
    cleanup();
  };

  el.addEventListener("transitionend", onTransitionEnd);

  const startExit = () => {
    if (exiting || dismissed) return;
    exiting = true;
    window.clearTimeout(dismissTimer);
    el.classList.add("is-leaving");
    window.setTimeout(() => {
      if (el.isConnected && !dismissed) cleanup();
    }, 500);
  };

  dismissTimer = window.setTimeout(startExit, item.durationMs);

  el.querySelector(".notify-close")?.addEventListener("click", startExit);

  raf2(() => {
    if (!el.isConnected || dismissed) return;
    el.classList.add("is-visible");
  });
}

/**
 * @param {{ getProductNames?: () => string[] | Promise<string[]> }} [options]
 */
async function resolveProductNames(options) {
  const fn = options?.getProductNames;
  if (typeof fn === "function") {
    try {
      const r = fn();
      const arr = await Promise.resolve(r);
      if (Array.isArray(arr) && arr.length) {
        const names = arr
          .map((x) => String(x ?? "").trim())
          .filter(Boolean);
        if (names.length) return names;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const data = await api("/api/catalog");
    const products = data.products || [];
    const names = products
      .map((p) => String(p.name ?? "").trim())
      .filter(Boolean);
    if (names.length) return names;
  } catch {
    /* ignore */
  }
  return ["Item do catálogo"];
}

function randomDelayMs() {
  const min = 60_000;
  const max = 180_000;
  return min + Math.random() * (max - min);
}

/**
 * Primeira notificação ~3 s após carregar; depois intervalos aleatórios entre 1 e 3 minutos.
 * @param {{ getProductNames?: () => string[] | Promise<string[]> }} [options]
 */
export function initSocialProof(options = {}) {
  if (started) return;
  if (!document.getElementById("notify-root")) return;
  started = true;

  let timerId = 0;

  const tick = async () => {
    try {
      const names = await resolveProductNames(options);
      const product = pick(names);
      notify({
        firstNameLabel: randomBuyerLabel(),
        product,
        city: pick(CITIES),
        durationMs: 2800,
      });
    } catch {
      /* ignore */
    }
    schedule();
  };

  /** @param {number} [delayMs] — omitido: intervalo aleatório 1–3 min (após o primeiro aviso) */
  const schedule = (delayMs) => {
    window.clearTimeout(timerId);
    const d =
      typeof delayMs === "number" && Number.isFinite(delayMs)
        ? delayMs
        : randomDelayMs();
    timerId = window.setTimeout(tick, d);
  };

  schedule(3000);
}
