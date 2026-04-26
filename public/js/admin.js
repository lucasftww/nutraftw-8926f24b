import { formatBRL, api, productImageUrl } from "./util.js";

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginErr = document.getElementById("login-err");
const logoutBtn = document.getElementById("logout");
const admEmailHint = document.getElementById("adm-email-hint");
const tableBody = document.querySelector("#product-table tbody");
const catTableBody = document.querySelector("#category-table tbody");
const form = document.getElementById("product-form");
const formTitle = document.getElementById("form-title");
const formErr = document.getElementById("form-err");
const editingId = document.getElementById("editing-id");

const catForm = document.getElementById("category-form");
const catFormTitle = document.getElementById("cat-form-title");
const catFormErr = document.getElementById("cat-form-err");
const catEditingId = document.getElementById("cat-editing-id");

const ordersTbody = document.getElementById("adm-orders-tbody");
const ordersErr = document.getElementById("adm-orders-err");
const ordersMeta = document.getElementById("adm-orders-meta");
const orderFilter = document.getElementById("adm-order-filter");
const ordersPrev = document.getElementById("adm-orders-prev");
const ordersNext = document.getElementById("adm-orders-next");
const ordersRefresh = document.getElementById("adm-orders-refresh");
const ordersExport = document.getElementById("adm-orders-export");
const ordersCityFilter = document.getElementById("adm-order-city-filter");
const ordersReadyOnly = document.getElementById("adm-order-ready-only");
const ordersSelectAll = document.getElementById("adm-orders-select-all");
const ordersSelectedCount = document.getElementById("adm-orders-selected-count");
const ordersCopyAddresses = document.getElementById("adm-orders-copy-addresses");
const ordersCopyContacts = document.getElementById("adm-orders-copy-contacts");
const ordersClearSelection = document.getElementById("adm-orders-clear-selection");

const orderModal = document.getElementById("adm-order-modal");
const orderModalBody = document.getElementById("adm-order-modal-body");
const orderModalBackdrop = document.getElementById("adm-order-modal-backdrop");
const orderModalClose = document.getElementById("adm-order-modal-close");

const dashErr = document.getElementById("adm-dash-err");
const statusList = document.getElementById("adm-status-list");
const dashSalesChart = document.getElementById("adm-dash-sales-chart");
const dashStatusDonut = document.getElementById("adm-dash-status-donut");
const dashCompletoCount = document.getElementById("adm-stat-completo-count");
const welcomeTitle = document.getElementById("adm-welcome-title");
const welcomeSub = document.getElementById("adm-welcome-sub");
const admAvatar = document.getElementById("adm-avatar");
const admHeaderNotifyDot = document.getElementById("adm-header-notify-dot");
const rootEl = document.getElementById("root");
const ordersSide = document.getElementById("adm-orders-side");
const productEditorShell = document.getElementById("adm-product-editor-shell");
const productEditorBackdrop = document.getElementById("adm-product-editor-backdrop");
const productEditorClose = document.getElementById("adm-product-editor-close");
const usersListEl = document.getElementById("adm-users-list");
const supportChatsEl = document.getElementById("adm-support-chats");
const supportMessagesEl = document.getElementById("adm-support-messages");
const supportChatMetaEl = document.getElementById("adm-support-chat-meta");
const supportResolveBtn = document.getElementById("adm-support-resolve");
const supportCloseBtn = document.getElementById("adm-support-close-chat");
const analyticsSeries = document.getElementById("adm-an-series");
const suppliersListEl = document.getElementById("adm-suppliers-list");
const stockAlertsEl = document.getElementById("adm-stock-alerts");
const stockMovementsEl = document.getElementById("adm-stock-movements");

const fImageFile = document.getElementById("f-image_file");
const fImageUploadMsg = document.getElementById("f-image_upload_msg");
const fImagePreview = document.getElementById("f-image_preview");
const fImagePreviewWrap = document.getElementById("f-image_preview_wrap");

const f = {
  category_id: document.getElementById("f-category_id"),
  slug: document.getElementById("f-slug"),
  name: document.getElementById("f-name"),
  description: document.getElementById("f-description"),
  price: document.getElementById("f-price"),
  compare_price: document.getElementById("f-compare_price"),
  on_offer: document.getElementById("f-on_offer"),
  image_url: document.getElementById("f-image_url"),
  stock: document.getElementById("f-stock"),
  active: document.getElementById("f-active"),
};

function setProductImagePreview(url) {
  const u = String(url || "").trim();
  if (!fImagePreview || !fImagePreviewWrap) return;
  if (u && (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/"))) {
    fImagePreview.src = u;
    fImagePreview.classList.remove("hidden");
    fImagePreviewWrap.classList.remove("hidden");
  } else {
    fImagePreview.removeAttribute("src");
    fImagePreview.classList.add("hidden");
    fImagePreviewWrap.classList.add("hidden");
  }
}

fImageFile?.addEventListener("change", async () => {
  if (fImageUploadMsg) fImageUploadMsg.textContent = "";
  const file = fImageFile?.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("image", file);
  if (fImageUploadMsg) fImageUploadMsg.textContent = "A enviar…";
  try {
    const r = await fetch("/api/admin/upload/product-image", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    const url = String(data.url || "");
    if (f.image_url) f.image_url.value = url;
    setProductImagePreview(url);
    if (fImageUploadMsg) fImageUploadMsg.textContent = "Imagem carregada.";
    fImageFile.value = "";
  } catch (e) {
    if (fImageUploadMsg) {
      fImageUploadMsg.textContent = e instanceof Error ? e.message : "Falha no upload.";
    }
    fImageFile.value = "";
  }
});

f.image_url?.addEventListener("blur", () => {
  setProductImagePreview(f.image_url.value.trim());
});

const cf = {
  slug: document.getElementById("cf-slug"),
  name: document.getElementById("cf-name"),
  sort: document.getElementById("cf-sort"),
  active: document.getElementById("cf-active"),
};

/** @type {{ id:number, name:string, slug:string }[]} */
let categoryList = [];

let admProdPage = 1;
const admProdPageSize = 40;

let ordersPage = 1;
const ordersPageSize = 25;
const selectedOrders = new Set();
let currentPanel = "dashboard";
let currentSupportChatId = 0;
let currentSupportChat = null;

function rowId(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showLoginErr(msg) {
  loginErr.textContent = msg || "";
  loginErr.classList.toggle("hidden", !msg);
}

function showFormErr(msg) {
  formErr.textContent = msg || "";
  formErr.classList.toggle("hidden", !msg);
}

function showCatFormErr(msg) {
  catFormErr.textContent = msg || "";
  catFormErr.classList.toggle("hidden", !msg);
}

function showOrdersErr(msg) {
  if (!ordersErr) return;
  ordersErr.textContent = msg || "";
  ordersErr.classList.toggle("hidden", !msg);
}

function showDashErr(msg) {
  if (!dashErr) return;
  dashErr.textContent = msg || "";
  dashErr.classList.toggle("hidden", !msg);
}

function isReadyForShippingStatus(status) {
  const s = String(status || "").toUpperCase();
  return s === "COMPLETO" || s === "PAGO" || s === "PREPARANDO_ENVIO";
}

function refreshOrdersSelectionUi() {
  if (ordersSelectedCount) {
    ordersSelectedCount.textContent = `${selectedOrders.size} selecionado(s)`;
  }
}

async function copyToClipboard(text) {
  const txt = String(text || "").trim();
  if (!txt) throw new Error("Nada para copiar.");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(txt);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = txt;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function can(permissions, key) {
  const arr = Array.isArray(permissions) ? permissions : [];
  return arr.includes("*") || arr.includes(key);
}

function firstNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const part = local.split(/[._-]/)[0] || local;
  if (!part) return "Admin";
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function setWelcomeUser(email) {
  const name = firstNameFromEmail(email);
  if (welcomeTitle) welcomeTitle.textContent = `Bem-vindo de volta, ${name}`;
  if (welcomeSub) {
    welcomeSub.textContent = "Aqui estão as métricas da sua loja online hoje.";
  }
  if (admAvatar) {
    const raw = String(email || "AD").slice(0, 2).toUpperCase();
    admAvatar.textContent = raw.length >= 2 ? raw.slice(0, 2) : "AD";
  }
}

function renderDashSalesChart(series, el) {
  if (!el) return;
  const pts = Array.isArray(series) ? series.slice(-14) : [];
  if (pts.length < 2) {
    el.innerHTML = `<p class="text-sm text-muted-foreground text-center py-8">Sem dados suficientes para o gráfico (últimos 14 dias).</p>`;
    return;
  }
  const w = 100;
  const h = 42;
  const pad = 4;
  const maxR = Math.max(...pts.map((p) => Number(p.revenueCents) || 0), 1);
  const xy = pts.map((p, i) => {
    const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((Number(p.revenueCents) || 0) / maxR) * (h - pad * 2);
    return { x, y };
  });
  const linePts = xy.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaPts = `${pad},${h - pad} ${linePts} ${w - pad},${h - pad}`;
  const d0 = String(pts[0]?.date || "").slice(5);
  const d1 = String(pts[pts.length - 1]?.date || "").slice(5);
  el.innerHTML = `
    <div class="w-full">
      <svg class="text-primary max-h-[220px]" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="adm-dash-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon fill="url(#adm-dash-grad)" points="${areaPts}" />
        <polyline fill="none" stroke="currentColor" stroke-width="1.25" vector-effect="non-scaling-stroke" points="${linePts}" />
        ${xy
          .map(
            (p) =>
              `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.4" fill="currentColor" stroke="#fff" stroke-width="0.35"/>`
          )
          .join("")}
      </svg>
      <div class="flex justify-between text-[0.65rem] text-slate-400 mt-2 font-medium">
        <span>${escapeHtml(d0)}</span>
        <span>Receita diária (PIX)</span>
        <span>${escapeHtml(d1)}</span>
      </div>
    </div>`;
}

function renderStatusDonut(rows, el) {
  if (!el) return;
  const data = (Array.isArray(rows) ? rows : []).filter((r) => Number(r.count) > 0);
  const total = data.reduce((s, r) => s + Number(r.count), 0);
  if (!total) {
    el.innerHTML = `<span class="text-muted-foreground text-center px-2 text-sm">Sem pedidos</span>`;
    return;
  }
  const colors = {
    COMPLETO: "#059669",
    PENDENTE: "#d97706",
    FALHA: "#dc2626",
    CANCELADO: "#64748b",
    PREPARANDO_ENVIO: "#2563eb",
    ENVIADO: "#7c3aed",
    ENTREGUE: "#0d9488",
    PAGO: "#059669",
  };
  let acc = 0;
  const parts = [];
  for (const r of data) {
    const frac = Number(r.count) / total;
    const st = String(r.status || "").toUpperCase();
    const c = colors[st] || "#6366f1";
    const start = acc * 360;
    const end = (acc + frac) * 360;
    parts.push(`${c} ${start}deg ${end}deg`);
    acc += frac;
  }
  el.innerHTML = `<div class="rounded-full w-[168px] h-[168px] flex items-center justify-center shadow-inner ring-1 ring-slate-900/10" style="background:conic-gradient(from -90deg, ${parts.join(
    ","
  )})"><div class="rounded-full w-[52%] h-[52%] bg-white flex flex-col items-center justify-center text-center p-2 shadow-md"><span class="text-xl font-bold text-slate-800 tabular-nums">${total}</span><span class="text-[0.65rem] text-slate-500 font-semibold uppercase tracking-wide">Pedidos</span></div></div>`;
}

function statusPillClass(status) {
  const u = String(status || "").toUpperCase();
  if (u === "COMPLETO" || u === "CONCLUIDO" || u === "PAGO" || u === "PAID") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-green-50 text-green-800 border-green-200";
  }
  if (u === "PENDENTE") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-amber-50 text-amber-900 border-amber-200";
  }
  if (u === "FALHA" || u === "CANCELADO") {
    return "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-destructive/10 text-destructive border-destructive/30";
  }
  return "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-muted text-muted-foreground border-border";
}

function supportStatusLabel(status) {
  const u = String(status || "").toUpperCase();
  if (u === "RESOLVED") return "Resolvido";
  if (u === "AUTO_CLOSED") return "Fechado (sem retorno)";
  if (u === "CLOSED") return "Fechado";
  return "Aberto";
}

function supportStatusPillClass(status) {
  const u = String(status || "").toUpperCase();
  if (u === "OPEN") return "inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800";
  if (u === "RESOLVED") return "inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800";
  return "inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700";
}

function renderSupportChatButton(c, selected) {
  const cid = Number(c.id);
  return `<button type="button" data-chat-open="${cid}" class="w-full text-left rounded-2xl border px-3 py-2.5 transition-colors ${selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:bg-muted/40"}">
    <div class="flex items-start justify-between gap-2">
      <p class="font-semibold text-foreground truncate">#${cid} · ${escapeHtml(c.customer_email || "Visitante")}</p>
      <div class="flex items-center gap-1">
        ${Number(c.unread_admin || 0) > 0 ? `<span class="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" title="Mensagem não lida"></span>` : ""}
      </div>
    </div>
    <div class="mt-1 flex items-center gap-2">
      <span class="${supportStatusPillClass(c.status)}">${escapeHtml(supportStatusLabel(c.status))}</span>
      <span class="text-[11px] text-muted-foreground">${escapeHtml(c.reason_category || "GERAL")}</span>
    </div>
    <p class="text-xs text-muted-foreground truncate mt-1">${escapeHtml(c.last_message_body || c.subject || "Sem mensagens")}</p>
  </button>`;
}

function activePill(on) {
  return on
    ? "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-primary/10 text-primary border-primary/30"
    : "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-muted text-muted-foreground border-border";
}

function stockPillClass(n) {
  const s = Math.floor(Number(n) || 0);
  if (s <= 0) {
    return "inline-flex items-center justify-center min-w-[2.75rem] px-2 py-1 rounded-lg text-xs font-bold border bg-red-50 text-red-800 border-red-200";
  }
  if (s < 5) {
    return "inline-flex items-center justify-center min-w-[2.75rem] px-2 py-1 rounded-lg text-xs font-bold border bg-amber-50 text-amber-900 border-amber-200";
  }
  return "inline-flex items-center justify-center min-w-[2.75rem] px-2 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200";
}

async function loadSiteSettingsForm() {
  const eta = document.getElementById("adm-freight-eta");
  const label = document.getElementById("adm-freight-label");
  const centsIn = document.getElementById("adm-freight-cents");
  const errEl = document.getElementById("adm-set-err");
  const okEl = document.getElementById("adm-set-ok");
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }
  if (okEl) okEl.classList.add("hidden");
  try {
    const data = await api("/api/admin/site-settings");
    if (eta) eta.value = data.freightEta ?? "";
    if (label) label.value = data.freightLabel ?? "";
    if (centsIn) {
      const stored = data.freightPadraoCentsStored;
      centsIn.value =
        stored != null && Number.isFinite(Number(stored))
          ? centsToInput(Number(stored))
          : "";
    }
  } catch (e) {
    if (errEl) {
      errEl.textContent =
        e instanceof Error ? e.message : "Erro ao carregar definições";
      errEl.classList.remove("hidden");
    }
  }
}

async function loadAnalyticsPanel() {
  const ticketEl = document.getElementById("adm-an-ticket");
  const revEl = document.getElementById("adm-an-revenue");
  const paidEl = document.getElementById("adm-an-paid");
  const lowEl = document.getElementById("adm-an-lowstock");
  try {
    const [ov, seriesData, visitsData, realtimeData] = await Promise.all([
      api("/api/admin/analytics/overview"),
      api("/api/admin/analytics/sales-series?days=30"),
      api("/api/admin/analytics/visits-series?days=30"),
      api("/api/admin/analytics/realtime-users?limit=25"),
    ]);
    if (ticketEl) ticketEl.textContent = formatBRL(Number(ov.ticketMedioCents) || 0);
    if (revEl) revEl.textContent = formatBRL(Number(ov.totalRevenueCents) || 0);
    if (paidEl) paidEl.textContent = String(ov.paidCount ?? 0);
    if (lowEl) lowEl.textContent = String(ov.lowStockCount ?? 0);
    const rows = Array.isArray(seriesData.series) ? seriesData.series : [];
    if (analyticsSeries) {
      if (!rows.length) {
        analyticsSeries.innerHTML = `<p>Sem dados para o período.</p>`;
      } else {
        const visitsMap = new Map(
          (Array.isArray(visitsData.series) ? visitsData.series : []).map((v) => [
            String(v.date),
            Number(v.visits) || 0,
          ])
        );
        const realtimeCount = Array.isArray(realtimeData.users)
          ? realtimeData.users.length
          : 0;
        analyticsSeries.innerHTML =
          `<p class="text-xs text-muted-foreground mb-2">Utilizadores ativos agora: <strong class="text-foreground">${realtimeCount}</strong></p>` +
          rows
          .slice(-10)
          .reverse()
          .map(
            (x) => `<div class="flex items-center justify-between border-b border-border/50 pb-2">
            <span>${escapeHtml(String(x.date || ""))}</span>
            <span class="font-semibold text-foreground">${formatBRL(Number(x.revenueCents) || 0)} · ${Number(x.orders) || 0} pedido(s) · ${visitsMap.get(String(x.date || "")) || 0} visitas</span>
          </div>`
          )
          .join("");
      }
    }
  } catch (e) {
    if (analyticsSeries) analyticsSeries.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro ao carregar analytics")}</p>`;
  }
}

async function loadInventoryPanel() {
  const thresholdEl = document.getElementById("adm-stock-threshold");
  try {
    const [alerts, moves] = await Promise.all([
      api("/api/admin/inventory/alerts"),
      api("/api/admin/inventory/movements?limit=25"),
    ]);
    if (thresholdEl && "value" in thresholdEl) thresholdEl.value = String(alerts.thresholdDefault ?? 5);
    if (stockAlertsEl) {
      const items = Array.isArray(alerts.products) ? alerts.products : [];
      if (!items.length) {
        stockAlertsEl.innerHTML = `<p class="text-emerald-700">Sem alertas de stock baixo.</p>`;
      } else {
        stockAlertsEl.innerHTML = items
          .map(
            (p) => `<div class="flex justify-between gap-2 border-b border-border/40 py-2">
            <span>${escapeHtml(p.name)} <span class="text-xs text-muted-foreground">#${p.id}</span></span>
            <span class="${stockPillClass(p.stock)}">${Number(p.stock) || 0}</span>
          </div>`
          )
          .join("");
      }
    }
    if (stockMovementsEl) {
      const rows = Array.isArray(moves.movements) ? moves.movements : [];
      if (!rows.length) {
        stockMovementsEl.innerHTML = `<p>Sem movimentações recentes.</p>`;
      } else {
        stockMovementsEl.innerHTML = rows
          .map(
            (m) => `<div class="flex flex-wrap justify-between gap-2 border-b border-border/40 py-2">
            <span>${escapeHtml(m.product_name || "")} <span class="text-xs text-muted-foreground">${escapeHtml(m.movement_type || "")}</span></span>
            <span class="font-semibold ${Number(m.qty_delta) >= 0 ? "text-emerald-700" : "text-destructive"}">${Number(m.qty_delta) >= 0 ? "+" : ""}${Number(m.qty_delta) || 0}</span>
          </div>`
          )
          .join("");
      }
    }
  } catch (e) {
    if (stockAlertsEl) stockAlertsEl.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro no painel de stock")}</p>`;
  }
}

async function loadSuppliersPanel() {
  try {
    const data = await api("/api/admin/suppliers");
    const rows = Array.isArray(data.suppliers) ? data.suppliers : [];
    if (!suppliersListEl) return;
    if (!rows.length) {
      suppliersListEl.innerHTML = `<p>Sem fornecedores registados.</p>`;
      return;
    }
    suppliersListEl.innerHTML = rows
      .map(
        (s) => `<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-2">
        <div>
          <p class="font-semibold text-foreground">${escapeHtml(s.name)}</p>
          <p class="text-xs text-muted-foreground">${escapeHtml(s.contact_email || "—")} · Prazo ${Number(s.lead_time_days) || 0}d</p>
        </div>
        <button type="button" data-supplier-edit="${Number(s.id)}" class="text-primary text-sm font-semibold hover:underline">Editar</button>
      </div>`
      )
      .join("");
    suppliersListEl.querySelectorAll("[data-supplier-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-supplier-edit"));
        const row = rows.find((x) => Number(x.id) === id);
        if (!row) return;
        const fId = document.getElementById("adm-supplier-id");
        const fName = document.getElementById("adm-supplier-name");
        const fMail = document.getElementById("adm-supplier-email");
        const fPhone = document.getElementById("adm-supplier-phone");
        const fLead = document.getElementById("adm-supplier-lead");
        const fActive = document.getElementById("adm-supplier-active");
        if (fId && "value" in fId) fId.value = String(row.id);
        if (fName && "value" in fName) fName.value = row.name || "";
        if (fMail && "value" in fMail) fMail.value = row.contact_email || "";
        if (fPhone && "value" in fPhone) fPhone.value = row.contact_phone || "";
        if (fLead && "value" in fLead) fLead.value = String(row.lead_time_days || 7);
        if (fActive && "checked" in fActive) fActive.checked = !!row.active;
      });
    });
  } catch (e) {
    if (suppliersListEl) suppliersListEl.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro ao listar fornecedores")}</p>`;
  }
}

async function loadAdminUsersPanel() {
  try {
    const data = await api("/api/admin/users");
    const rows = Array.isArray(data.users) ? data.users : [];
    if (!usersListEl) return;
    if (!rows.length) {
      usersListEl.innerHTML = `<p>Sem administradores cadastrados.</p>`;
      return;
    }
    usersListEl.innerHTML = rows
      .map(
        (u) => `<div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-2">
        <div>
          <p class="font-semibold text-foreground">${escapeHtml(u.email)}</p>
          <p class="text-xs text-muted-foreground">${escapeHtml((u.permissions || []).join(", ") || "*")}</p>
        </div>
        <button type="button" data-user-edit="${Number(u.id)}" class="text-primary text-sm font-semibold hover:underline">Editar</button>
      </div>`
      )
      .join("");
    usersListEl.querySelectorAll("[data-user-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-user-edit"));
        const row = rows.find((x) => Number(x.id) === id);
        if (!row) return;
        const idEl = document.getElementById("adm-user-id");
        const emailEl = document.getElementById("adm-user-email");
        if (idEl && "value" in idEl) idEl.value = String(row.id);
        if (emailEl && "value" in emailEl) emailEl.value = row.email || "";
        document.querySelectorAll(".adm-perm").forEach((c) => {
          c.checked = Array.isArray(row.permissions)
            ? row.permissions.includes(c.value) || row.permissions.includes("*")
            : false;
        });
      });
    });
  } catch (e) {
    if (usersListEl) usersListEl.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro ao listar admins")}</p>`;
  }
}

async function loadSupportPanel() {
  try {
    const data = await api("/api/admin/support/chats");
    const chats = Array.isArray(data.chats) ? data.chats : [];
    if (!supportChatsEl) return;
    if (!chats.length) {
      supportChatsEl.innerHTML = `<p>Sem conversas no momento.</p>`;
      if (supportMessagesEl) supportMessagesEl.innerHTML = `<p class="text-muted-foreground">Selecione um chat.</p>`;
      if (supportChatMetaEl) supportChatMetaEl.textContent = "";
      currentSupportChat = null;
      if (supportResolveBtn) supportResolveBtn.disabled = true;
      if (supportCloseBtn) supportCloseBtn.disabled = true;
      return;
    }
    const openChats = chats.filter((x) => String(x.status || "").toUpperCase() === "OPEN");
    const closedChats = chats.filter((x) => String(x.status || "").toUpperCase() !== "OPEN");
    if (currentSupportChatId && !chats.some((x) => Number(x.id) === Number(currentSupportChatId))) {
      currentSupportChatId = 0;
    }
    supportChatsEl.innerHTML = `
      <section class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <p class="text-xs font-bold uppercase tracking-wide text-emerald-700">Em aberto</p>
          <span class="text-[11px] text-muted-foreground">${openChats.length}</span>
        </div>
        <div class="space-y-2">
          ${
            openChats.length
              ? openChats
                  .map((c) => renderSupportChatButton(c, Number(c.id) === Number(currentSupportChatId)))
                  .join("")
              : `<p class="text-xs text-muted-foreground px-2 py-1">Sem chats em aberto.</p>`
          }
        </div>
      </section>
      <section class="space-y-2 pt-2 border-t border-border/60">
        <div class="flex items-center justify-between px-1">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-600">Fechados</p>
          <span class="text-[11px] text-muted-foreground">${closedChats.length}</span>
        </div>
        <div class="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          ${
            closedChats.length
              ? closedChats
                  .map((c) => renderSupportChatButton(c, Number(c.id) === Number(currentSupportChatId)))
                  .join("")
              : `<p class="text-xs text-muted-foreground px-2 py-1">Sem chats fechados.</p>`
          }
        </div>
      </section>
    `;
    supportChatsEl.querySelectorAll("[data-chat-open]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        currentSupportChatId = Number(btn.getAttribute("data-chat-open"));
        await openSupportChat(currentSupportChatId);
        await loadSupportPanel();
      });
    });
    if (!currentSupportChatId) {
      currentSupportChatId = Number((openChats[0] || chats[0]).id);
    }
    currentSupportChat = chats.find((x) => Number(x.id) === Number(currentSupportChatId)) || null;
    await openSupportChat(currentSupportChatId);
  } catch (e) {
    if (supportChatsEl) supportChatsEl.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro ao carregar suporte")}</p>`;
  }
}

async function openSupportChat(chatId) {
  if (!supportMessagesEl || !chatId) return;
  try {
    const d = await api(`/api/admin/support/chats/${encodeURIComponent(chatId)}`);
    const chat = d.chat || null;
    currentSupportChat = chat;
    const msgs = Array.isArray(d.messages) ? d.messages : [];
    supportMessagesEl.innerHTML = msgs
      .map((m) => {
        const admin = String(m.sender_role || "").toUpperCase() === "ADMIN";
        const dt = String(m.created_at || "").replace("T", " ").slice(0, 16);
        return `<div class="flex ${admin ? "justify-end" : "justify-start"}">
          <div class="max-w-[85%] px-3 py-2 rounded-2xl shadow-sm ${admin ? "bg-primary text-primary-foreground rounded-br-md" : "bg-white text-foreground border border-border/70 rounded-bl-md"}">
            <p class="whitespace-pre-wrap break-words">${escapeHtml(m.body)}</p>
            <p class="text-[10px] mt-1 ${admin ? "text-primary-foreground/70" : "text-muted-foreground"} text-right">${escapeHtml(dt)}</p>
          </div>
        </div>`;
      })
      .join("");
    if (!msgs.length) {
      supportMessagesEl.innerHTML = `<p class="text-muted-foreground">Sem mensagens ainda.</p>`;
    }
    supportMessagesEl.scrollTop = supportMessagesEl.scrollHeight;
    if (supportChatMetaEl && chat) {
      const reason = chat.reason_category || "GERAL";
      const detail = chat.reason_detail ? ` · ${chat.reason_detail}` : "";
      supportChatMetaEl.textContent = `#${chat.id} · ${supportStatusLabel(chat.status)} · ${reason}${detail}`;
    }
    const isOpen = String(chat?.status || "").toUpperCase() === "OPEN";
    if (supportResolveBtn) supportResolveBtn.disabled = !isOpen;
    if (supportCloseBtn) supportCloseBtn.disabled = !isOpen;
    const replyInput = document.getElementById("adm-support-reply-input");
    const replyBtn = document.querySelector("#adm-support-reply-form button[type='submit']");
    if (replyInput && "disabled" in replyInput) replyInput.disabled = !isOpen;
    if (replyBtn && "disabled" in replyBtn) replyBtn.disabled = !isOpen;
  } catch (e) {
    supportMessagesEl.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro ao abrir chat")}</p>`;
  }
}

function setPanel(name) {
  currentPanel = name;
  document.querySelectorAll(".adm-panel").forEach((el) => {
    el.classList.toggle("hidden", el.id !== `panel-${name}`);
  });
  document.querySelectorAll("#adm-nav .adm-nav-btn").forEach((btn) => {
    const on = btn.dataset.admPanel === name;
    btn.classList.toggle("bg-primary", on);
    btn.classList.toggle("text-primary-foreground", on);
    btn.classList.toggle("shadow-sm", on);
    btn.classList.toggle("border-transparent", on);
    btn.classList.toggle("border-border", !on);
    btn.classList.toggle("text-foreground", !on);
    btn.classList.toggle("hover:bg-muted/50", !on);
  });

  if (name === "dashboard") loadDashboard();
  if (name === "orders") loadOrders();
  if (name === "categories") {
    loadCategoryTable();
    loadCategoryOptions();
  }
  if (name === "products") {
    void loadCategoryOptions().then(() => loadTable());
  }
  if (name === "loja") void loadSiteSettingsForm();
  if (name === "analytics") void loadAnalyticsPanel();
  if (name === "inventory") void loadInventoryPanel();
  if (name === "suppliers") void loadSuppliersPanel();
  if (name === "admin-users") void loadAdminUsersPanel();
  if (name === "support") void loadSupportPanel();
}

document.querySelectorAll("#adm-nav .adm-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => setPanel(btn.dataset.admPanel || "dashboard"));
});
document.querySelectorAll("[data-adm-panel]").forEach((el) => {
  if (el.classList.contains("adm-nav-btn")) return;
  el.addEventListener("click", () => {
    const p = el.getAttribute("data-adm-panel") || "dashboard";
    setPanel(p);
  });
});

function closeOrderModal() {
  orderModal?.classList.add("hidden");
  orderModal?.setAttribute("aria-hidden", "true");
}

function openProductEditor() {
  if (!productEditorShell) return;
  productEditorShell.classList.remove("hidden");
  productEditorShell.setAttribute("aria-hidden", "false");
}

function closeProductEditor() {
  if (!productEditorShell) return;
  productEditorShell.classList.add("hidden");
  productEditorShell.setAttribute("aria-hidden", "true");
}

productEditorBackdrop?.addEventListener("click", closeProductEditor);
productEditorClose?.addEventListener("click", closeProductEditor);

orderModalBackdrop?.addEventListener("click", closeOrderModal);
orderModalClose?.addEventListener("click", closeOrderModal);

async function loadDashboard() {
  showDashErr("");
  try {
    const [data, salesRes] = await Promise.all([
      api("/api/admin/stats"),
      api("/api/admin/analytics/sales-series?days=14").catch(() => ({ series: [] })),
    ]);
    const c = data.catalog || {};
    const pa = document.getElementById("adm-stat-pa");
    const pt = document.getElementById("adm-stat-pt");
    const ca = document.getElementById("adm-stat-ca");
    const ct = document.getElementById("adm-stat-ct");
    const pend = document.getElementById("adm-stat-pend");
    const rev = document.getElementById("adm-stat-rev");
    if (pa) pa.textContent = String(c.productsActive ?? "—");
    if (pt) pt.textContent = String(c.productsTotal ?? "—");
    if (ca) ca.textContent = String(c.categoriesActive ?? "—");
    if (ct) ct.textContent = String(c.categoriesTotal ?? "—");
    if (pend) pend.textContent = String(c.ordersPending ?? "—");
    if (rev) rev.textContent = formatBRL(Number(c.revenueCompleteCents) || 0);
    const rows = data.ordersByStatus || [];
    const compRow = rows.find((r) => String(r.status || "").toUpperCase() === "COMPLETO");
    if (dashCompletoCount) dashCompletoCount.textContent = String(compRow?.count ?? 0);
    if (admHeaderNotifyDot) {
      admHeaderNotifyDot.classList.toggle("hidden", Number(c.ordersPending ?? 0) <= 0);
    }
    renderDashSalesChart(Array.isArray(salesRes.series) ? salesRes.series : [], dashSalesChart);
    renderStatusDonut(rows, dashStatusDonut);
    if (statusList) {
      if (!rows.length) {
        statusList.innerHTML = `<li class="text-muted-foreground py-3">Ainda não há pedidos PIX.</li>`;
      } else {
        statusList.innerHTML = rows
          .map(
            (r) => `
          <li class="flex justify-between items-center gap-3 py-3">
            <span class="${statusPillClass(r.status)}">${escapeHtml(r.status)}</span>
            <span class="font-display text-lg font-bold text-foreground tabular-nums">${r.count}</span>
          </li>`
          )
          .join("");
      }
    }
  } catch (e) {
    showDashErr(e instanceof Error ? e.message : "Erro ao carregar painel");
  }
}

async function loadOrders() {
  showOrdersErr("");
  if (!ordersTbody) return;
  ordersTbody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>`;
  try {
    const st = orderFilter?.value || "";
    const data = await api(
      `/api/admin/orders?page=${ordersPage}&pageSize=${ordersPageSize}${st ? `&status=${encodeURIComponent(st)}` : ""}`
    );
    const { orders, total, page, pageSize } = data;
    const cityQ = String(ordersCityFilter?.value || "").trim().toLowerCase();
    const readyOnly = !!ordersReadyOnly?.checked;
    const visibleOrders = (Array.isArray(orders) ? orders : []).filter((o) => {
      const okCity = !cityQ || String(o.city || "").toLowerCase().includes(cityQ);
      const okReady = !readyOnly || isReadyForShippingStatus(o.status);
      return okCity && okReady;
    });
    if (!visibleOrders.length) {
      ordersTbody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-muted-foreground">Sem pedidos para os filtros atuais.</td></tr>`;
      if (ordersSelectAll) ordersSelectAll.checked = false;
    } else {
      ordersTbody.innerHTML = visibleOrders
        .map((o) => {
          const dt = o.createdAt ? escapeHtml(String(o.createdAt).replace("T", " ").slice(0, 19)) : "—";
          const cust = o.customerEmail
            ? escapeHtml(o.customerEmail)
            : escapeHtml(o.payerName || "—");
          const contact = escapeHtml(o.phone || o.customerEmail || "—");
          const loc =
            o.city && o.stateUf
              ? `${escapeHtml(o.city)} / ${escapeHtml(o.stateUf)}`
              : escapeHtml(o.city || "—");
          const isReady = isReadyForShippingStatus(o.status);
          const ext = escapeHtml(o.externalId);
          return `<tr class="border-b border-border/40 hover:bg-muted/30 transition-colors">
            <td class="px-3 py-3"><input type="checkbox" class="adm-order-select rounded border-input" data-ext="${ext}" ${selectedOrders.has(String(o.externalId)) ? "checked" : ""} /></td>
            <td class="px-4 py-3 text-muted-foreground whitespace-nowrap">${dt}</td>
            <td class="px-4 py-3 font-mono text-xs">${ext}</td>
            <td class="px-4 py-3">${cust}</td>
            <td class="px-4 py-3 text-muted-foreground">${contact}</td>
            <td class="px-4 py-3 text-muted-foreground">${loc}</td>
            <td class="px-4 py-3 font-semibold text-primary">${formatBRL(o.amountCents)}</td>
            <td class="px-4 py-3"><span class="${statusPillClass(o.status)}">${escapeHtml(o.status)}</span>${isReady ? `<span class="ml-1 inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800">envio</span>` : ""}</td>
            <td class="px-4 py-3 text-right">
              <button type="button" class="text-primary font-semibold text-sm hover:underline adm-order-open" data-ext="${ext}">Ver</button>
            </td>
          </tr>`;
        })
        .join("");
      ordersTbody.querySelectorAll(".adm-order-select").forEach((el) => {
        el.addEventListener("change", () => {
          const ext = String(el.getAttribute("data-ext") || "");
          if (!ext) return;
          if (el.checked) selectedOrders.add(ext);
          else selectedOrders.delete(ext);
          refreshOrdersSelectionUi();
        });
      });
      ordersTbody.querySelectorAll(".adm-order-open").forEach((btn) => {
        btn.addEventListener("click", () => openOrderDetail(btn.getAttribute("data-ext") || ""));
      });
      if (ordersSelectAll) {
        const allVisibleIds = visibleOrders.map((o) => String(o.externalId));
        const allChecked = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedOrders.has(id));
        ordersSelectAll.checked = allChecked;
      }
    }
    const totalPages = Math.max(1, Math.ceil(Number(total) / Number(pageSize)));
    if (ordersMeta) {
      const readyCount = (Array.isArray(orders) ? orders : []).filter((o) =>
        isReadyForShippingStatus(o.status)
      ).length;
      ordersMeta.textContent = `Página ${page} de ${totalPages} · ${total} pedido(s) · ${readyCount} pronto(s) para envio nesta página`;
    }
    if (ordersPrev) ordersPrev.disabled = page <= 1;
    if (ordersNext) ordersNext.disabled = page >= totalPages;
    refreshOrdersSelectionUi();
  } catch (e) {
    ordersTbody.innerHTML = "";
    showOrdersErr(e instanceof Error ? e.message : "Erro ao listar pedidos");
  }
}

orderFilter?.addEventListener("change", () => {
  ordersPage = 1;
  loadOrders();
});
ordersCityFilter?.addEventListener("input", () => {
  loadOrders();
});
ordersReadyOnly?.addEventListener("change", () => {
  loadOrders();
});
ordersSelectAll?.addEventListener("change", () => {
  const checked = !!ordersSelectAll.checked;
  ordersTbody?.querySelectorAll(".adm-order-select").forEach((el) => {
    const ext = String(el.getAttribute("data-ext") || "");
    if (!ext) return;
    el.checked = checked;
    if (checked) selectedOrders.add(ext);
    else selectedOrders.delete(ext);
  });
  refreshOrdersSelectionUi();
});
ordersRefresh?.addEventListener("click", () => loadOrders());
ordersPrev?.addEventListener("click", () => {
  if (ordersPage > 1) {
    ordersPage -= 1;
    loadOrders();
  }
});
ordersNext?.addEventListener("click", () => {
  ordersPage += 1;
  loadOrders();
});

ordersClearSelection?.addEventListener("click", () => {
  selectedOrders.clear();
  if (ordersSelectAll) ordersSelectAll.checked = false;
  loadOrders();
});

async function fetchOrderDetailsForSelection() {
  const ids = [...selectedOrders];
  if (!ids.length) throw new Error("Selecione pelo menos um pedido.");
  const details = await Promise.all(
    ids.map(async (id) => {
      const d = await api(`/api/admin/orders/${encodeURIComponent(id)}`);
      return d.order;
    })
  );
  return details;
}

ordersCopyAddresses?.addEventListener("click", async () => {
  try {
    const details = await fetchOrderDetailsForSelection();
    const text = details
      .map((o, idx) => {
        const ch = o.checkout || {};
        const phone = String(ch.phone || "").trim();
        return `${idx + 1}) ${o.externalId} — ${o.payerName || "Cliente"}${phone ? ` (${phone})` : ""}
${formatAddress(ch) || "Sem endereço completo"}
Obs: ${String(ch.remarks || "-")}`;
      })
      .join("\n\n");
    await copyToClipboard(text);
    alert(`Endereços copiados (${details.length} pedido(s)).`);
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro ao copiar endereços");
  }
});

ordersCopyContacts?.addEventListener("click", async () => {
  try {
    const details = await fetchOrderDetailsForSelection();
    const text = details
      .map((o) => {
        const ch = o.checkout || {};
        const phone = String(ch.phone || "").trim();
        const email = String(ch.email || o.customerEmail || "").trim();
        return `${o.externalId}; ${o.payerName || "-"}; ${phone || "-"}; ${email || "-"}`;
      })
      .join("\n");
    await copyToClipboard(text);
    alert(`Contactos copiados (${details.length} pedido(s)).`);
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro ao copiar contactos");
  }
});

function formatAddress(ch) {
  if (!ch || typeof ch !== "object") return "";
  const parts = [
    ch.street && ch.number ? `${ch.street}, ${ch.number}` : ch.street,
    ch.complement,
    ch.district,
    ch.city && ch.stateUf ? `${ch.city} — ${ch.stateUf}` : ch.city,
    ch.cep ? `CEP ${ch.cep}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

async function openOrderDetail(externalId) {
  if (ordersSide) {
    ordersSide.innerHTML = `<p class="text-muted-foreground">A carregar…</p>`;
  }
  if (!orderModal || !orderModalBody) return;
  orderModalBody.innerHTML = `<p class="text-muted-foreground">A carregar…</p>`;
  try {
    const data = await api(`/api/admin/orders/${encodeURIComponent(externalId)}`);
    const o = data.order;
    const ch = o.checkout || {};
    const lines = Array.isArray(o.lines) ? o.lines : [];
    const linesHtml = lines.length
      ? `<ul class="gi-admin-detail-lineitems space-y-2">${lines
          .map(
            (l) =>
              `<li class="flex justify-between gap-2 px-3 py-2.5"><span class="text-foreground">${escapeHtml(l.name)} <span class="text-muted-foreground">× ${escapeHtml(String(l.qty || 0))}</span></span><span class="font-semibold tabular-nums">${formatBRL((l.price_cents || 0) * (l.qty || 0))}</span></li>`
          )
          .join("")}</ul>`
      : "<p class=\"text-muted-foreground\">Sem linhas.</p>";

    const detailHtml = `
      <div class="gi-admin-detail-stack text-foreground">
        <div class="gi-admin-detail-section">
          <div class="gi-admin-detail-kv">
            <p class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">ID externo</p>
            <p class="font-mono text-xs break-all font-medium">${escapeHtml(o.externalId)}</p>
          </div>
          <div class="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/60">
            <div class="gi-admin-detail-kv"><p class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">PaySync</p><p class="font-mono text-xs break-all">${escapeHtml(String(o.mpTransactionId))}</p></div>
            <div class="gi-admin-detail-kv"><p class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Estado</p><p><span class="${statusPillClass(o.status)}">${escapeHtml(o.status)}</span></p></div>
            <div class="gi-admin-detail-kv"><p class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Valor total</p><p class="text-xl font-display font-bold text-primary">${formatBRL(o.amountCents)}</p></div>
            <div class="gi-admin-detail-kv"><p class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Criado</p><p class="text-sm">${escapeHtml(String(o.createdAt || "—"))}</p></div>
          </div>
        </div>
        <div class="gi-admin-detail-section">
          <h3>Comprador</h3>
          <div class="space-y-1.5 text-sm">
            <p><span class="text-muted-foreground">Nome:</span> ${escapeHtml(o.payerName || "—")}</p>
            <p><span class="text-muted-foreground">CPF:</span> ${escapeHtml(o.payerDocument || "—")}</p>
            <p><span class="text-muted-foreground">E-mail:</span> ${escapeHtml(ch.email || "—")}</p>
            <p><span class="text-muted-foreground">Telefone:</span> ${escapeHtml(ch.phone || "—")}</p>
          </div>
        </div>
        <div class="gi-admin-detail-section">
          <h3>Entrega</h3>
          <p class="text-sm text-foreground leading-relaxed">${escapeHtml(formatAddress(ch) || "—")}</p>
          ${ch.freightCents != null ? `<p class="text-sm mt-2"><span class="text-muted-foreground">Frete:</span> <span class="font-semibold">${formatBRL(ch.freightCents)}</span></p>` : ""}
          ${ch.insuranceCents ? `<p class="text-sm"><span class="text-muted-foreground">Seguro:</span> ${formatBRL(ch.insuranceCents)}</p>` : ""}
          ${ch.remarks ? `<p class="text-sm mt-2"><span class="text-muted-foreground">Obs.:</span> ${escapeHtml(ch.remarks)}</p>` : ""}
        </div>
        <div class="gi-admin-detail-section">
          <h3>Itens</h3>
          ${linesHtml}
        </div>
        <details class="rounded-xl border border-border bg-white p-3 text-sm">
          <summary class="cursor-pointer font-semibold text-foreground">JSON checkout (debug)</summary>
          <pre class="mt-2 text-xs overflow-x-auto p-2 bg-slate-50 rounded-lg border border-border">${escapeHtml(JSON.stringify(ch, null, 2))}</pre>
        </details>
      </div>
    `;
    orderModalBody.innerHTML = detailHtml;
    if (ordersSide) ordersSide.innerHTML = detailHtml;
  } catch (e) {
    orderModalBody.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro")}</p>`;
    if (ordersSide) ordersSide.innerHTML = `<p class="text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro")}</p>`;
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && orderModal && !orderModal.classList.contains("hidden")) {
    closeOrderModal();
  }
  if (e.key === "Escape" && productEditorShell && !productEditorShell.classList.contains("hidden")) {
    closeProductEditor();
  }
});

async function refreshSession() {
  try {
    const { user } = await api("/api/me");
    if (user && user.role === "admin") {
      const perms = Array.isArray(user.permissions) ? user.permissions : ["*"];
      loginView.classList.add("hidden");
      appView.classList.remove("hidden");
      rootEl?.classList.add("gi-admin-app-mode");
      logoutBtn.hidden = false;
      if (admEmailHint) {
        admEmailHint.textContent = user.email || "";
        admEmailHint.hidden = false;
      }
      setWelcomeUser(user.email || "");
      try {
        await loadCategoryOptions();
      } catch {
        categoryList = [];
        if (f.category_id) f.category_id.innerHTML = "";
        populateProductCategoryFilter();
      }
      document.querySelectorAll("#adm-nav [data-adm-panel]").forEach((btn) => {
        const p = btn.getAttribute("data-adm-panel") || "";
        let show = true;
        if (p === "dashboard" || p === "analytics") show = can(perms, "dashboard");
        if (p === "orders") show = can(perms, "orders.read");
        if (p === "products") show = can(perms, "products.read");
        if (p === "categories") show = can(perms, "categories.read");
        if (p === "loja") show = can(perms, "settings");
        if (p === "support") show = can(perms, "support");
        if (p === "admin-users") show = can(perms, "manage_admins");
        if (p === "inventory" || p === "suppliers") show = can(perms, "dashboard") || can(perms, "products.read");
        btn.classList.toggle("hidden", !show);
      });
      setPanel(currentPanel);
      return;
    }
  } catch {
    /* ignore */
  }
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  rootEl?.classList.remove("gi-admin-app-mode");
  logoutBtn.hidden = true;
  if (admEmailHint) admEmailHint.hidden = true;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoginErr("");
  const fd = new FormData(loginForm);
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "");
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (data.role !== "admin") {
      await api("/api/logout", { method: "POST" });
      showLoginErr(
        "Esta área é só para administradores. Utilize /login para clientes."
      );
      return;
    }
    currentPanel = "dashboard";
    await refreshSession();
  } catch (err) {
    showLoginErr(err.message || "Falha no login");
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  closeOrderModal();
  await refreshSession();
});

document.getElementById("adm-header-search")?.addEventListener("click", () => {
  setPanel("products");
  const q = document.getElementById("adm-prod-q");
  if (q && "focus" in q) (q).focus();
});

document.getElementById("adm-header-notify")?.addEventListener("click", () => {
  setPanel("orders");
});

document.getElementById("adm-dash-export-csv")?.addEventListener("click", async () => {
  try {
    const r = await fetch("/api/admin/orders/export.csv", { credentials: "same-origin" });
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("Não foi possível exportar o CSV. Verifique sessão e permissões.");
  }
});

function eurosToCents(str) {
  const n = String(str).replace(",", ".").trim();
  const v = parseFloat(n);
  if (Number.isNaN(v)) return 0;
  return Math.round(v * 100);
}

function centsToInput(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function populateProductCategoryFilter() {
  const sel = document.getElementById("adm-prod-cat");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = `<option value="">Todas as categorias</option>`;
  for (const c of categoryList) {
    const o = document.createElement("option");
    o.value = String(c.id);
    o.textContent = c.name;
    sel.appendChild(o);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

async function loadCategoryOptions() {
  const data = await api("/api/admin/categories");
  categoryList = Array.isArray(data.categories) ? data.categories : [];
  if (f.category_id) {
    const sel = f.category_id;
    sel.innerHTML = "";
    for (const c of categoryList) {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = c.name;
      sel.appendChild(o);
    }
  }
  populateProductCategoryFilter();
}

async function loadCategoryTable() {
  if (!catTableBody) return;
  catTableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>`;
  showCatFormErr("");
  try {
    const data = await api("/api/admin/categories");
    const categories = Array.isArray(data.categories) ? data.categories : [];
    categoryList = categories;
    catTableBody.innerHTML = "";
    for (const c of categories) {
      const cid = rowId(c.id);
      const tr = document.createElement("tr");
      tr.className = "border-b border-border/40 hover:bg-muted/20";
      tr.innerHTML = `
      <td class="px-4 py-3">${escapeHtml(String(c.id))}</td>
      <td class="px-4 py-3 font-mono text-xs">${escapeHtml(c.slug)}</td>
      <td class="px-4 py-3 font-medium">${escapeHtml(c.name)}</td>
      <td class="px-4 py-3">${escapeHtml(String(c.sort_order ?? ""))}</td>
      <td class="px-4 py-3">${escapeHtml(String(c.product_count ?? 0))}</td>
      <td class="px-4 py-3"><span class="${activePill(!!c.active)}">${c.active ? "Ativa" : "Inativa"}</span></td>
      <td class="px-4 py-3 text-right space-x-2">
        <button type="button" class="text-primary font-semibold text-sm hover:underline" data-cat-edit="${cid}">Editar</button>
        <button type="button" class="text-destructive font-semibold text-sm hover:underline" data-cat-del="${cid}">Apagar</button>
      </td>
    `;
      catTableBody.appendChild(tr);
    }
    catTableBody.querySelectorAll("[data-cat-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = rowId(btn.getAttribute("data-cat-edit"));
        const row = categories.find((x) => rowId(x.id) === id);
        if (!row) {
          alert("Não foi possível localizar esta categoria na lista. Atualize a página.");
          return;
        }
        fillCatForm(row);
      });
    });
    catTableBody.querySelectorAll("[data-cat-del]").forEach((btn) => {
      btn.addEventListener("click", () =>
        removeCategory(rowId(btn.getAttribute("data-cat-del")))
      );
    });
    await loadCategoryOptions();
  } catch (e) {
    catTableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-destructive">${escapeHtml(e instanceof Error ? e.message : "Erro ao listar categorias")}</td></tr>`;
    showCatFormErr(e instanceof Error ? e.message : "Erro ao listar categorias");
  }
}

async function loadTable() {
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>`;
  const qEl = document.getElementById("adm-prod-q");
  const catEl = document.getElementById("adm-prod-cat");
  const qVal = qEl && qEl instanceof HTMLInputElement ? qEl.value.trim() : "";
  const catVal = catEl && catEl instanceof HTMLSelectElement ? catEl.value.trim() : "";
  const params = new URLSearchParams();
  params.set("page", String(admProdPage));
  params.set("pageSize", String(admProdPageSize));
  if (qVal) params.set("q", qVal);
  if (catVal) params.set("category_id", catVal);
  try {
    const data = await api(`/api/admin/products?${params.toString()}`);
    const products = data.products || [];
    const total = Number(data.total) || 0;
    const page = Number(data.page) || 1;
    const pageSize = Number(data.pageSize) || admProdPageSize;
    tableBody.innerHTML = "";
    if (!products.length) {
      tableBody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-muted-foreground">Nenhum produto nesta vista.</td></tr>`;
    } else {
      for (const p of products) {
        const tr = document.createElement("tr");
        tr.className = "border-b border-border/40 hover:bg-muted/20";
        const pid = rowId(p.id);
        const imgSrc = escapeHtml(productImageUrl(p.image_url));
        const stockN = Math.floor(Number(p.stock) || 0);
        const stockHint =
          stockN <= 0 ? "Sem stock" : stockN < 5 ? "Stock baixo" : "Em stock";
        tr.innerHTML = `
      <td class="px-3 py-2 align-middle w-16">
        <img src="${imgSrc}" alt="" width="56" height="56" class="w-14 h-14 rounded-xl object-cover bg-muted border border-border shadow-sm" loading="lazy" />
      </td>
      <td class="px-4 py-3 align-top min-w-[200px]">
        <div class="font-semibold text-foreground leading-snug">${escapeHtml(p.name)}</div>
        <div class="text-xs font-mono text-muted-foreground mt-1">${escapeHtml(p.slug)} · #${escapeHtml(String(p.id))}</div>
      </td>
      <td class="px-4 py-3 align-top text-muted-foreground">${escapeHtml(p.category_name || "—")}</td>
      <td class="px-4 py-3 align-top whitespace-nowrap">
        <span class="${stockPillClass(p.stock)}" title="${escapeHtml(stockHint)}">${escapeHtml(String(stockN))}</span>
      </td>
      <td class="px-4 py-3 align-top font-semibold text-primary">${formatBRL(p.price_cents)}</td>
      <td class="px-4 py-3 align-top">${p.on_offer ? `<span class="${activePill(true)}">Oferta</span>` : `<span class="${activePill(false)}">Normal</span>`}</td>
      <td class="px-4 py-3 align-top"><span class="${activePill(!!p.active)}">${p.active ? "Ativo" : "Inativo"}</span></td>
      <td class="px-4 py-3 align-top text-right space-x-2 whitespace-nowrap">
        <button type="button" class="text-primary font-semibold text-sm hover:underline" data-edit="${pid}">Editar</button>
        <button type="button" class="text-destructive font-semibold text-sm hover:underline" data-del="${pid}">Apagar</button>
      </td>
    `;
        tableBody.appendChild(tr);
      }
    }
    tableBody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = rowId(btn.getAttribute("data-edit"));
        try {
          const { product } = await api(`/api/admin/products/${id}`);
          fillForm(product);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Erro ao carregar produto");
        }
      });
    });
    tableBody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () =>
        removeProduct(rowId(btn.getAttribute("data-del")))
      );
    });
    const meta = document.getElementById("adm-prod-meta");
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (meta) {
      meta.textContent = `Página ${page} de ${totalPages} · ${total} produto(s)`;
    }
    const prev = document.getElementById("adm-prod-prev");
    const next = document.getElementById("adm-prod-next");
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= totalPages;
  } catch (e) {
    tableBody.innerHTML = "";
    alert(e instanceof Error ? e.message : "Erro ao listar produtos");
  }
}

function fillForm(p) {
  if (!p) return;
  editingId.value = String(p.id);
  formTitle.textContent = "Editar produto";
  f.slug.value = p.slug;
  f.name.value = p.name;
  f.description.value = p.description || "";
  f.price.value = centsToInput(p.price_cents);
  f.compare_price.value = centsToInput(p.compare_price_cents || 0);
  f.on_offer.checked = !!p.on_offer;
  f.image_url.value = p.image_url || "";
  f.stock.value = String(p.stock);
  f.active.checked = !!p.active;
  if (f.category_id && p.category_id) {
    f.category_id.value = String(p.category_id);
  }
  if (fImageFile) fImageFile.value = "";
  if (fImageUploadMsg) fImageUploadMsg.textContent = "";
  setProductImagePreview(p.image_url || "");
  showFormErr("");
  openProductEditor();
}

document.getElementById("new-product").addEventListener("click", () => {
  editingId.value = "";
  formTitle.textContent = "Novo produto";
  form.reset();
  f.active.checked = true;
  if (f.on_offer) f.on_offer.checked = false;
  if (f.compare_price) f.compare_price.value = "";
  if (f.category_id && f.category_id.options.length) {
    f.category_id.selectedIndex = 0;
  }
  if (fImageFile) fImageFile.value = "";
  if (fImageUploadMsg) fImageUploadMsg.textContent = "";
  setProductImagePreview("");
  showFormErr("");
  openProductEditor();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormErr("");
  const id = editingId.value ? Number(editingId.value) : null;
  const catVal = f.category_id ? String(f.category_id.value || "").trim() : "";
  const catNum = catVal ? rowId(catVal) : NaN;
  if (!f.category_id || !Number.isInteger(catNum) || catNum < 1) {
    showFormErr("Selecione uma categoria (crie uma em «Categorias» se a lista estiver vazia).");
    return;
  }
  const priceCents = eurosToCents(f.price.value);
  const comparePriceCents = eurosToCents(f.compare_price.value);
  const onOffer = !!f.on_offer.checked;
  if (onOffer && comparePriceCents <= priceCents) {
    showFormErr("Em oferta, o preço sem oferta deve ser maior que o preço atual.");
    return;
  }
  const body = {
    category_id: catNum,
    slug: f.slug.value.trim() || undefined,
    name: f.name.value.trim(),
    description: f.description.value,
    price_cents: priceCents,
    compare_price_cents: comparePriceCents,
    on_offer: onOffer,
    image_url: f.image_url.value.trim(),
    stock: Number(f.stock.value) || 0,
    active: f.active.checked,
  };
  try {
    if (id) {
      await api(`/api/admin/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    await loadTable();
    closeProductEditor();
    editingId.value = "";
    form.reset();
    if (currentPanel === "dashboard") loadDashboard();
  } catch (err) {
    showFormErr(err.message || "Erro ao guardar");
  }
});

async function removeProduct(id) {
  if (!Number.isInteger(id) || id < 1) {
    alert("ID de produto inválido.");
    return;
  }
  if (!confirm("Apagar este produto?")) return;
  try {
    await api(`/api/admin/products/${id}`, { method: "DELETE" });
    await loadTable();
    if (currentPanel === "dashboard") loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

function fillCatForm(c) {
  if (!c) return;
  catEditingId.value = String(c.id);
  catFormTitle.textContent = "Editar categoria";
  cf.slug.value = c.slug;
  cf.name.value = c.name;
  cf.sort.value = String(c.sort_order ?? 0);
  cf.active.checked = !!c.active;
  showCatFormErr("");
  catForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("new-category").addEventListener("click", () => {
  catEditingId.value = "";
  catFormTitle.textContent = "Nova categoria";
  catForm.reset();
  cf.active.checked = true;
  cf.sort.value = "0";
  showCatFormErr("");
});

catForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showCatFormErr("");
  const id = catEditingId.value ? Number(catEditingId.value) : null;
  const body = {
    slug: cf.slug.value.trim() || undefined,
    name: cf.name.value.trim(),
    sort_order: Number(cf.sort.value) || 0,
    active: cf.active.checked,
  };
  try {
    if (id) {
      await api(`/api/admin/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    await loadCategoryTable();
    try {
      await loadTable();
    } catch {
      /* painel pode não estar em produtos; falha ao refrescar não invalida a categoria */
    }
    document.getElementById("new-category").click();
    if (currentPanel === "dashboard") loadDashboard();
  } catch (err) {
    showCatFormErr(err.message || "Erro ao guardar categoria");
  }
});

async function removeCategory(id) {
  if (!Number.isInteger(id) || id < 1) {
    alert("ID de categoria inválido.");
    return;
  }
  if (!confirm("Apagar esta categoria?")) return;
  try {
    await api(`/api/admin/categories/${id}`, { method: "DELETE" });
    await loadCategoryTable();
    try {
      await loadTable();
    } catch {
      /* ignorar se o painel de produtos não estiver acessível */
    }
    if (currentPanel === "dashboard") loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById("adm-prod-search")?.addEventListener("click", () => {
  admProdPage = 1;
  loadTable();
});
document.getElementById("adm-prod-q")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    admProdPage = 1;
    loadTable();
  }
});
document.getElementById("adm-prod-prev")?.addEventListener("click", () => {
  if (admProdPage > 1) {
    admProdPage -= 1;
    loadTable();
  }
});
document.getElementById("adm-prod-next")?.addEventListener("click", () => {
  admProdPage += 1;
  loadTable();
});

document.getElementById("adm-site-settings")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("adm-set-err");
  const okEl = document.getElementById("adm-set-ok");
  const eta = document.getElementById("adm-freight-eta");
  const label = document.getElementById("adm-freight-label");
  const centsIn = document.getElementById("adm-freight-cents");
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.textContent = "";
  }
  if (okEl) okEl.classList.add("hidden");
  const centsRaw = centsIn && "value" in centsIn ? String(centsIn.value).trim() : "";
  const body = {
    freightEta: eta && "value" in eta ? eta.value : "",
    freightLabel: label && "value" in label ? label.value : "",
    freightPadraoCents: centsRaw === "" ? "" : eurosToCents(centsRaw),
  };
  try {
    await api("/api/admin/site-settings", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (okEl) okEl.classList.remove("hidden");
    await loadSiteSettingsForm();
  } catch (err) {
    if (errEl) {
      errEl.textContent = err instanceof Error ? err.message : "Erro ao guardar";
      errEl.classList.remove("hidden");
    }
  }
});

ordersExport?.addEventListener("click", async () => {
  try {
    const r = await fetch("/api/admin/orders/export.csv", {
      credentials: "same-origin",
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || r.statusText);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gimports-pedidos-pix.csv";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro ao exportar");
  }
});

document.getElementById("adm-analytics-refresh")?.addEventListener("click", () => {
  void loadAnalyticsPanel();
});
document.getElementById("adm-stock-refresh")?.addEventListener("click", () => {
  void loadInventoryPanel();
});
document.getElementById("adm-suppliers-refresh")?.addEventListener("click", () => {
  void loadSuppliersPanel();
});
document.getElementById("adm-users-refresh")?.addEventListener("click", () => {
  void loadAdminUsersPanel();
});
document.getElementById("adm-support-refresh")?.addEventListener("click", () => {
  void loadSupportPanel();
});
supportResolveBtn?.addEventListener("click", async () => {
  if (!currentSupportChatId) return;
  try {
    await api(`/api/admin/support/chats/${encodeURIComponent(currentSupportChatId)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    await loadSupportPanel();
    await openSupportChat(currentSupportChatId);
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro ao resolver chamado");
  }
});
supportCloseBtn?.addEventListener("click", async () => {
  if (!currentSupportChatId) return;
  try {
    await api(`/api/admin/support/chats/${encodeURIComponent(currentSupportChatId)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: "CLOSED" }),
    });
    await loadSupportPanel();
    await openSupportChat(currentSupportChatId);
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro ao fechar chamado");
  }
});
document.getElementById("adm-stock-threshold-save")?.addEventListener("click", async () => {
  const input = document.getElementById("adm-stock-threshold");
  const n = input && "value" in input ? Number(input.value) : NaN;
  try {
    await api("/api/admin/inventory/settings/low-stock-threshold", {
      method: "PUT",
      body: JSON.stringify({ threshold: Number.isFinite(n) ? n : 5 }),
    });
    void loadInventoryPanel();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Erro ao guardar threshold");
  }
});

document.getElementById("adm-stock-adjust-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const productIdEl = document.getElementById("adm-stock-product-id");
  const deltaEl = document.getElementById("adm-stock-delta");
  const reasonEl = document.getElementById("adm-stock-reason");
  const msgEl = document.getElementById("adm-stock-adjust-msg");
  const productId = productIdEl && "value" in productIdEl ? Number(productIdEl.value) : NaN;
  const qtyDelta = deltaEl && "value" in deltaEl ? Number(deltaEl.value) : NaN;
  const reason = reasonEl && "value" in reasonEl ? String(reasonEl.value).trim() : "";
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.classList.add("hidden");
  }
  try {
    await api("/api/admin/inventory/adjust", {
      method: "POST",
      body: JSON.stringify({ productId, qtyDelta, reason }),
    });
    if (msgEl) {
      msgEl.textContent = "Ajuste aplicado.";
      msgEl.className = "text-sm text-emerald-700";
      msgEl.classList.remove("hidden");
    }
    void loadInventoryPanel();
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err instanceof Error ? err.message : "Erro ao ajustar";
      msgEl.className = "text-sm text-destructive";
      msgEl.classList.remove("hidden");
    }
  }
});

document.getElementById("adm-supplier-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idEl = document.getElementById("adm-supplier-id");
  const nameEl = document.getElementById("adm-supplier-name");
  const emailEl = document.getElementById("adm-supplier-email");
  const phoneEl = document.getElementById("adm-supplier-phone");
  const leadEl = document.getElementById("adm-supplier-lead");
  const activeEl = document.getElementById("adm-supplier-active");
  const msgEl = document.getElementById("adm-supplier-msg");
  const id = idEl && "value" in idEl ? String(idEl.value).trim() : "";
  const body = {
    name: nameEl && "value" in nameEl ? String(nameEl.value).trim() : "",
    contact_email: emailEl && "value" in emailEl ? String(emailEl.value).trim() : "",
    contact_phone: phoneEl && "value" in phoneEl ? String(phoneEl.value).trim() : "",
    lead_time_days: leadEl && "value" in leadEl ? Number(leadEl.value) : 7,
    active: activeEl && "checked" in activeEl ? !!activeEl.checked : true,
  };
  try {
    if (id) {
      await api(`/api/admin/suppliers/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      await api("/api/admin/suppliers", {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    if (idEl && "value" in idEl) idEl.value = "";
    if (msgEl) {
      msgEl.textContent = "Fornecedor guardado.";
      msgEl.className = "text-sm text-emerald-700";
      msgEl.classList.remove("hidden");
    }
    void loadSuppliersPanel();
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err instanceof Error ? err.message : "Erro ao guardar fornecedor";
      msgEl.className = "text-sm text-destructive";
      msgEl.classList.remove("hidden");
    }
  }
});

document.getElementById("adm-user-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const idEl = document.getElementById("adm-user-id");
  const emailEl = document.getElementById("adm-user-email");
  const passEl = document.getElementById("adm-user-password");
  const msgEl = document.getElementById("adm-user-msg");
  const id = idEl && "value" in idEl ? String(idEl.value).trim() : "";
  const email = emailEl && "value" in emailEl ? String(emailEl.value).trim() : "";
  const password = passEl && "value" in passEl ? String(passEl.value) : "";
  const permissions = [...document.querySelectorAll(".adm-perm")]
    .filter((x) => x.checked)
    .map((x) => x.value);
  const body = { email, permissions };
  if (password) body.password = password;
  try {
    if (id) {
      await api(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      if (!password) throw new Error("Defina uma senha para novo admin.");
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, permissions }),
      });
    }
    if (idEl && "value" in idEl) idEl.value = "";
    if (passEl && "value" in passEl) passEl.value = "";
    if (msgEl) {
      msgEl.textContent = "Admin guardado com sucesso.";
      msgEl.className = "text-sm text-emerald-700";
      msgEl.classList.remove("hidden");
    }
    void loadAdminUsersPanel();
  } catch (err) {
    if (msgEl) {
      msgEl.textContent = err instanceof Error ? err.message : "Erro ao guardar admin";
      msgEl.className = "text-sm text-destructive";
      msgEl.classList.remove("hidden");
    }
  }
});

document.getElementById("adm-support-reply-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentSupportChatId) return;
  if (String(currentSupportChat?.status || "").toUpperCase() !== "OPEN") {
    alert("Este chamado já está fechado. Reabra para responder.");
    return;
  }
  const input = document.getElementById("adm-support-reply-input");
  const body = input && "value" in input ? String(input.value).trim() : "";
  if (!body) return;
  try {
    await api(`/api/admin/support/chats/${encodeURIComponent(currentSupportChatId)}/reply`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    if (input && "value" in input) input.value = "";
    await openSupportChat(currentSupportChatId);
    await loadSupportPanel();
  } catch (err) {
    alert(err instanceof Error ? err.message : "Erro ao enviar resposta");
  }
});

setInterval(() => {
  if (currentPanel === "support") void loadSupportPanel();
}, 8000);

refreshSession();
