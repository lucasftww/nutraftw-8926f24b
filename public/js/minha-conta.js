import { api, formatBRL } from "./util.js";

const shell = document.getElementById("mc-shell");
const gate = document.getElementById("mc-gate");
const gateMsg = document.getElementById("mc-gate-msg");
const emailEl = document.getElementById("mc-email");
const logoutBtn = document.getElementById("mc-logout");
const tabs = document.querySelectorAll("[data-mc-tab]");
const panels = {
  pedidos: document.getElementById("panel-pedidos"),
  afiliados: document.getElementById("panel-afiliados"),
  rifas: document.getElementById("panel-rifas"),
};
const ordersErr = document.getElementById("mc-orders-err");
const ordersLoading = document.getElementById("mc-orders-loading");
const ordersEmpty = document.getElementById("mc-orders-empty");
const ordersList = document.getElementById("mc-orders-list");
const refreshBtn = document.getElementById("mc-refresh");

let pollTimer = 0;
/** @type {string | null} */
let activeTab = "pedidos";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priceLine(cents) {
  return formatBRL(cents).replace(/\s/g, "\u00a0").replace("R$", "R$\u00a0");
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(String(iso).replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function statusLabel(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETO") return "Pago";
  if (s === "PENDENTE") return "Pagamento pendente";
  if (s === "FALHA" || s === "CANCELADO") return "Não concluído";
  return s || "—";
}

function statusBadgeClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETO") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s === "PENDENTE") return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function setTab(name) {
  activeTab = name;
  tabs.forEach((btn) => {
    const t = btn.getAttribute("data-mc-tab");
    const on = t === name;
    btn.classList.toggle("bg-primary", on);
    btn.classList.toggle("text-white", on);
    btn.classList.toggle("text-foreground", !on);
    btn.classList.toggle("hover:bg-muted", !on);
  });
  Object.entries(panels).forEach(([k, el]) => {
    if (el) el.classList.toggle("hidden", k !== name);
  });
  if (name === "pedidos") startPoll();
  else stopPoll();
}

function stopPoll() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = 0;
  }
}

function startPoll() {
  stopPoll();
  pollTimer = window.setInterval(() => {
    if (activeTab === "pedidos") loadOrders(false);
  }, 45000);
}

function showOrdersErr(msg) {
  if (!ordersErr) return;
  ordersErr.textContent = msg || "";
  ordersErr.classList.toggle("hidden", !msg);
}

/** @param {any} o */
function orderCardHtml(o) {
  const titles = Array.isArray(o.lineTitles) ? o.lineTitles : [];
  const titleBits =
    titles.length > 0
      ? titles.join(" · ")
      : `${o.itemCount || 0} item(ns)`;
  const ship =
    o.shipping?.city && o.shipping?.stateUf
      ? `${esc(o.shipping.city)} · ${esc(o.shipping.stateUf)}`
      : "";
  const cep = o.shipping?.cep ? esc(o.shipping.cep) : "";
  const pixHint =
    o.pix && o.pix.split && o.pix.partsTotal > 1
      ? `<p class="text-xs text-muted-foreground mt-1">PIX em parcelas: <strong>${Number(o.pix.partsPaid) || 0}</strong> de <strong>${o.pix.partsTotal}</strong> confirmadas</p>`
      : "";
  const pending = String(o.status || "").toUpperCase() === "PENDENTE";
  const payHref = `/checkout?order=${encodeURIComponent(String(o.externalId || ""))}`;
  const pendingActions = pending
    ? `<div class="flex flex-col sm:flex-row gap-2 pt-2 w-full">
      <a href="${esc(payHref)}" class="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-95 transition-opacity">Pagar agora</a>
      <button type="button" class="mc-cancel-btn inline-flex items-center justify-center h-10 px-4 rounded-xl border-2 border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5">Cancelar pedido</button>
    </div>`
    : "";

  return `<article class="rounded-2xl border border-border bg-white shadow-sm overflow-hidden" data-order-id="${esc(o.externalId)}">
  <div class="p-4 sm:p-5 flex flex-col gap-3">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pedido</p>
        <p class="font-mono text-sm font-semibold text-foreground">${esc(o.externalId)}</p>
        <p class="text-xs text-muted-foreground mt-1">Registado em ${formatDateTime(o.createdAt)}</p>
      </div>
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeClass(o.status)}">${esc(statusLabel(o.status))}</span>
    </div>
    <p class="text-sm text-foreground"><span class="text-muted-foreground">Total:</span> <strong>${priceLine(o.amountCents)}</strong></p>
    <p class="text-sm text-muted-foreground line-clamp-2">${esc(titleBits)}</p>
    ${pixHint}
    ${ship ? `<p class="text-xs text-muted-foreground">Envio: ${ship}${cep ? ` · CEP ${cep}` : ""}</p>` : ""}
    ${pendingActions}
    <button type="button" class="mc-detail-btn inline-flex items-center justify-center h-10 px-4 rounded-xl border border-primary/25 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors w-full sm:w-auto">
      Ver detalhes e estado
    </button>
    <div class="mc-detail hidden border-t border-border pt-4 mt-1 space-y-3 text-sm"></div>
  </div>
</article>`;
}

/** @param {HTMLElement} wrap */
async function loadOrderDetail(wrap, externalId) {
  const slot = wrap.querySelector(".mc-detail");
  if (!slot) return;
  slot.classList.remove("hidden");
  wrap.setAttribute("data-expanded", "1");
  slot.innerHTML =
    '<p class="text-muted-foreground text-xs py-2">A carregar detalhes…</p>';
  try {
    const data = await api(`/api/me/orders/${encodeURIComponent(externalId)}`);
    const order = data.order;
    const timeline = Array.isArray(data.timeline) ? data.timeline : [];
    const lines = Array.isArray(order.lines) ? order.lines : [];
    const checkout = order.checkout && typeof order.checkout === "object" ? order.checkout : {};
    const parts = Array.isArray(checkout.pixParts) ? checkout.pixParts : [];

    let linesHtml = lines
      .map(
        (l) =>
          `<li class="flex justify-between gap-2 py-1 border-b border-border/50 last:border-0"><span>${esc(l.name)} × ${esc(String(l.qty))}</span><span class="font-medium">${priceLine((l.price_cents || 0) * (l.qty || 1))}</span></li>`
      )
      .join("");

    const tlHtml = timeline
      .map(
        (step) => `
      <div class="flex gap-3">
        <div class="flex flex-col items-center pt-0.5">
          <span class="w-2.5 h-2.5 rounded-full ${step.done ? "bg-primary" : "bg-muted"}"></span>
          <span class="w-px flex-1 min-h-[12px] bg-border ${step.done ? "" : "opacity-40"}"></span>
        </div>
        <div class="pb-3">
          <p class="font-semibold text-foreground">${esc(step.title)}</p>
          <p class="text-xs text-muted-foreground">${esc(step.detail)}</p>
          ${step.at ? `<p class="text-[11px] text-muted-foreground mt-0.5">${formatDateTime(step.at)}</p>` : ""}
        </div>
      </div>`
      )
      .join("");

    let partsHtml = "";
    if (parts.length > 1) {
      partsHtml =
        `<p class="text-xs font-semibold text-foreground uppercase tracking-wide mt-2">Parcelas PIX</p><ul class="mt-1 space-y-1 text-xs">` +
        parts
          .map(
            (p, i) =>
              `<li class="flex justify-between gap-2"><span>Parcela ${i + 1}</span><span>${esc(String(p.status || ""))} · ${priceLine(p.amountCents || 0)}</span></li>`
          )
          .join("") +
        "</ul>";
    }

    const pend = String(order.status || "").toUpperCase() === "PENDENTE";
    const payHref = `/checkout?order=${encodeURIComponent(String(order.externalId || ""))}`;
    const detailActions = pend
      ? `<div class="sm:col-span-2 mt-4 pt-4 border-t border-border flex flex-col sm:flex-row gap-2">
      <a href="${esc(payHref)}" class="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-95">Pagar agora</a>
      <button type="button" class="mc-cancel-btn inline-flex items-center justify-center h-10 px-4 rounded-xl border-2 border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5">Cancelar pedido</button>
    </div>`
      : "";

    slot.innerHTML = `
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-semibold text-muted-foreground uppercase mb-2">Cronologia</p>
          <div>${tlHtml}</div>
        </div>
        <div>
          <p class="text-xs font-semibold text-muted-foreground uppercase mb-2">Itens</p>
          <ul class="rounded-xl border border-border bg-slate-50/80 px-3">${linesHtml || "<li class='py-2 text-muted-foreground'>Sem linhas.</li>"}</ul>
          ${partsHtml}
          <p class="text-xs text-muted-foreground mt-3">Última atualização: ${formatDateTime(order.updatedAt)}</p>
        </div>
        ${detailActions}
      </div>`;
  } catch (e) {
    slot.innerHTML = `<p class="text-destructive text-sm">${esc(e.message || "Erro ao carregar.")}</p>`;
  }
}

async function loadOrders(showLoading) {
  showOrdersErr("");
  if (showLoading && ordersLoading) {
    ordersLoading.classList.remove("hidden");
    ordersEmpty?.classList.add("hidden");
    ordersList?.classList.add("hidden");
  }
  try {
    const data = await api("/api/me/orders");
    const orders = data.orders || [];
    if (ordersLoading) ordersLoading.classList.add("hidden");
    if (!orders.length) {
      ordersEmpty?.classList.remove("hidden");
      ordersList?.classList.add("hidden");
      if (ordersList) ordersList.innerHTML = "";
      return;
    }
    ordersEmpty?.classList.add("hidden");
    ordersList?.classList.remove("hidden");
    if (ordersList) {
      ordersList.innerHTML = orders.map(orderCardHtml).join("");
      ordersList.querySelectorAll("article").forEach((article) => {
        const id = article.getAttribute("data-order-id");
        const btn = article.querySelector(".mc-detail-btn");
        const slot = article.querySelector(".mc-detail");
        btn?.addEventListener("click", async () => {
          if (!id || !slot) return;
          if (article.getAttribute("data-expanded") === "1") {
            slot.classList.add("hidden");
            slot.innerHTML = "";
            article.setAttribute("data-expanded", "0");
            return;
          }
          await loadOrderDetail(article, id);
        });
      });
    }
  } catch (e) {
    if (ordersLoading) ordersLoading.classList.add("hidden");
    showOrdersErr(e.message || "Não foi possível carregar os pedidos.");
  }
}

logoutBtn?.addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {
    /* ignore */
  }
  window.location.href = "/login.html";
});

tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.getAttribute("data-mc-tab");
    if (name) setTab(name);
  });
});

refreshBtn?.addEventListener("click", () => loadOrders(true));

ordersList?.addEventListener("click", async (ev) => {
  const btn = ev.target && /** @type {HTMLElement} */ (ev.target).closest(".mc-cancel-btn");
  if (!btn) return;
  ev.preventDefault();
  const article = btn.closest("article");
  const id = article?.getAttribute("data-order-id");
  if (!id) return;
  if (
    !confirm(
      "Cancelar este pedido pendente? Se mudar de ideias, terá de efetuar um novo pedido na loja."
    )
  ) {
    return;
  }
  showOrdersErr("");
  try {
    await api(`/api/me/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await loadOrders(false);
  } catch (e) {
    showOrdersErr(e instanceof Error ? e.message : "Não foi possível cancelar.");
  }
});

(async function init() {
  try {
    const { user } = await api("/api/me");
    if (!user) {
      if (gateMsg) gateMsg.textContent = "Inicie sessão para ver a sua conta.";
      return;
    }
    if (user.role === "admin") {
      window.location.replace("/admin");
      return;
    }
    if (user.role !== "customer") {
      if (gateMsg) gateMsg.textContent = "Área disponível apenas para clientes.";
      return;
    }
    gate?.classList.add("hidden");
    shell?.classList.remove("hidden");
    if (emailEl) emailEl.textContent = user.email || "";
    setTab("pedidos");
    await loadOrders(true);
    startPoll();
  } catch {
    if (gateMsg) gateMsg.textContent = "Não foi possível verificar a sessão.";
  }
})();
