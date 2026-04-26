import { getCartLines, clearCart } from "./cart.js";
import { api, formatBRL, productImageUrl } from "./util.js";
import { initSocialProof } from "./social-notify.js";

const errEl = document.getElementById("chk-err");
const form = document.getElementById("chk-form");
const stepPix = document.getElementById("chk-step-pix");
const submitBtn = document.getElementById("chk-submit");
const pixAmount = document.getElementById("chk-pix-amount");
const pixSplitHint = document.getElementById("chk-pix-split-hint");
const qrVisual = document.getElementById("chk-qr");
const copyTa = document.getElementById("chk-copy");
const copyBtn = document.getElementById("chk-copy-btn");
const pixPartsWrap = document.getElementById("chk-pix-parts");
const statusEl = document.getElementById("chk-status");
const cepMsg = document.getElementById("chk-cep-msg");
const insuranceCb = document.getElementById("chk-insurance");
const fretePrecoEl = document.getElementById("chk-frete-preco");
const freteEtaEl = document.getElementById("chk-frete-eta");
const sideLines = document.getElementById("chk-side-lines");
const sideSub = document.getElementById("chk-side-sub");
const sideFrete = document.getElementById("chk-side-frete");
const sideFreteLabel = document.getElementById("chk-side-frete-label");
const sideInsRow = document.getElementById("chk-side-insurance-row");
const sideIns = document.getElementById("chk-side-insurance");
const sideTotal = document.getElementById("chk-side-total");

/** @type {{ freightPadraoCents: number; freightLabel: string; freightEta: string }} */
let cfg = { freightPadraoCents: 8000, freightLabel: "Frete (Padrão)", freightEta: "7 a 10 dias úteis" };

function showErr(msg) {
  if (!errEl) return;
  if (!msg) {
    errEl.textContent = "";
    errEl.classList.add("hidden");
    return;
  }
  errEl.textContent = msg;
  errEl.classList.remove("hidden");
}

function priceLine(cents) {
  return formatBRL(cents).replace(/\s/g, "\u00a0").replace("R$", "R$\u00a0");
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function computeTotals() {
  const lines = getCartLines();
  let subtotal = 0;
  for (const l of lines) subtotal += l.price_cents * l.qty;
  const freight = cfg.freightPadraoCents;
  const insurance = insuranceCb?.checked ? Math.round(subtotal * 0.1) : 0;
  const grand = subtotal + freight + insurance;
  return { lines, subtotal, freight, insurance, grand };
}

function renderSidebar() {
  const { lines, subtotal, freight, insurance, grand } = computeTotals();
  if (!sideLines) return;
  if (!lines.length) {
    sideLines.innerHTML = `<p class="text-sm text-muted-foreground">Carrinho vazio.</p>`;
  } else {
    sideLines.innerHTML = lines
      .map(
        (l) => `
      <div class="flex gap-3">
        <div class="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0 bg-muted/30">
          <img alt="" class="w-full h-full object-cover" width="56" height="56" src="${escapeHtml(productImageUrl(l.image_url))}" loading="lazy" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium text-foreground leading-snug line-clamp-2">${escapeHtml(l.name)}</div>
          <div class="text-xs text-muted-foreground mt-0.5">Qtd ${l.qty}</div>
          <div class="text-sm font-semibold text-primary mt-1">${priceLine(l.price_cents * l.qty)}</div>
        </div>
      </div>`
      )
      .join("");
  }
  if (sideSub) sideSub.textContent = priceLine(subtotal);
  if (sideFrete) sideFrete.textContent = priceLine(freight);
  if (sideFreteLabel) sideFreteLabel.textContent = cfg.freightLabel;
  if (fretePrecoEl) fretePrecoEl.textContent = priceLine(freight);
  if (freteEtaEl) freteEtaEl.textContent = cfg.freightEta;
  if (insurance > 0) {
    sideInsRow?.classList.remove("hidden");
    sideInsRow?.classList.add("flex");
    if (sideIns) sideIns.textContent = priceLine(insurance);
  } else {
    sideInsRow?.classList.add("hidden");
    sideInsRow?.classList.remove("flex");
  }
  if (sideTotal) sideTotal.textContent = priceLine(grand);
}

async function loadConfig() {
  try {
    const d = await api("/api/checkout/config");
    cfg = {
      freightPadraoCents: Math.max(0, Math.floor(Number(d.freightPadraoCents) || 8000)),
      freightLabel: String(d.freightLabel || "Frete (Padrão)"),
      freightEta: String(d.freightEta || "7 a 10 dias úteis"),
    };
  } catch {
    /* defaults */
  }
  renderSidebar();
}

insuranceCb?.addEventListener("change", renderSidebar);

document.getElementById("chk-cep")?.addEventListener("blur", async () => {
  if (!cepMsg) return;
  cepMsg.textContent = "";
  const cep = digitsOnly(
    /** @type {HTMLInputElement} */ (document.getElementById("chk-cep"))?.value || ""
  );
  if (cep.length !== 8) return;
  cepMsg.textContent = "A buscar CEP…";
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const j = await r.json();
    if (j.erro) {
      cepMsg.textContent = "CEP não encontrado.";
      return;
    }
    const street = document.getElementById("chk-street");
    const district = document.getElementById("chk-district");
    const city = document.getElementById("chk-city");
    const state = document.getElementById("chk-state");
    if (street instanceof HTMLInputElement) street.value = j.logradouro || "";
    if (district instanceof HTMLInputElement) district.value = j.bairro || "";
    if (city instanceof HTMLInputElement) city.value = j.localidade || "";
    if (state instanceof HTMLSelectElement && j.uf) state.value = j.uf;
    cepMsg.textContent = j.logradouro ? "Endereço preenchido." : "CEP válido.";
  } catch {
    cepMsg.textContent = "Não foi possível consultar o CEP. Preencha manualmente.";
  }
});

let pollTimer = null;
let externalId = "";

/** Só usado para texto de ajuda quando há várias parcelas PIX (legado). */
const DEFAULT_PIX_LIMIT_CENTS = 100000;

/**
 * Mostra o passo PIX (novo pedido ou retomar pedido pendente).
 * @param {{
 *   externalId: string;
 *   grandTotalCents: number;
 *   copyPaste?: string;
 *   qrCodeBase64?: string;
 *   qrcodeUrl?: string;
 *   pixParts?: unknown[];
 *   pixLimitCents?: number;
 * }} payload
 */
function showCheckoutPixStep(payload) {
  stopPoll();
  externalId = payload.externalId;
  showErr("");
  form?.classList.add("hidden");
  stepPix?.classList.remove("hidden");
  const cents = Math.max(0, Math.floor(Number(payload.grandTotalCents) || 0));
  if (pixAmount) pixAmount.textContent = priceLine(cents);
  const parts = Array.isArray(payload.pixParts) ? payload.pixParts : [];
  const first = /** @type {{ copyPaste?: string; qrCodeBase64?: string; qrcodeUrl?: string }} */ (
    parts[0] || {}
  );
  const paste = payload.copyPaste || first.copyPaste || "";
  if (copyTa) copyTa.value = paste;
  const lim = Number.isFinite(Number(payload.pixLimitCents))
    ? Number(payload.pixLimitCents)
    : DEFAULT_PIX_LIMIT_CENTS;
  updateSplitHint(parts, lim);
  renderPixParts(parts);
  const b64 = payload.qrCodeBase64 ?? first.qrCodeBase64;
  const url = payload.qrcodeUrl ?? first.qrcodeUrl;
  if (qrVisual) {
    if (b64) {
      qrVisual.src = String(b64).startsWith("data:")
        ? String(b64)
        : `data:image/png;base64,${String(b64)}`;
      qrVisual.classList.remove("hidden");
    } else if (url) {
      qrVisual.src = url;
      qrVisual.classList.remove("hidden");
    } else {
      qrVisual.removeAttribute("src");
      qrVisual.classList.add("hidden");
    }
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  pollStatus();
  pollTimer = setInterval(pollStatus, 4000);
}

/** @returns {Promise<boolean>} true se tratou URL `?order=` (retoma ou erro/login). */
async function tryResumeOrderFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const oid = params.get("order")?.trim();
  if (!oid) return false;
  try {
    const me = await api("/api/me");
    if (!me?.user || me.user.role !== "customer") {
      const next = encodeURIComponent(
        `${window.location.pathname}?order=${encodeURIComponent(oid)}`
      );
      window.location.href = `/login.html?next=${next}`;
      return true;
    }
    const data = await api(`/api/me/orders/${encodeURIComponent(oid)}`);
    const order = data.order;
    if (!order) {
      showErr("Pedido não encontrado.");
      return true;
    }
    const st = String(order.status || "").toUpperCase();
    if (st !== "PENDENTE") {
      showErr("Este pedido já não está pendente de pagamento.");
      return true;
    }
    const checkout =
      order.checkout && typeof order.checkout === "object" ? order.checkout : {};
    const parts = Array.isArray(checkout.pixParts) ? checkout.pixParts : [];
    if (!parts.length) {
      showErr("Não foi possível recuperar os dados PIX deste pedido.");
      return true;
    }
    const first = /** @type {{ copyPaste?: string; qrCodeBase64?: string; qrcodeUrl?: string }} */ (
      parts[0] || {}
    );
    showCheckoutPixStep({
      externalId: order.externalId,
      grandTotalCents: order.amountCents,
      copyPaste: first.copyPaste || "",
      qrCodeBase64: first.qrCodeBase64,
      qrcodeUrl: first.qrcodeUrl,
      pixParts: parts,
      pixLimitCents: DEFAULT_PIX_LIMIT_CENTS,
    });
    return true;
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String(/** @type {{ message?: string }} */ (e).message)
        : "Não foi possível abrir o pedido.";
    showErr(msg);
    return true;
  }
}

function renderPixParts(parts) {
  if (!pixPartsWrap) return;
  const arr = Array.isArray(parts) ? parts : [];
  if (arr.length <= 1) {
    pixPartsWrap.classList.add("hidden");
    pixPartsWrap.innerHTML = "";
    return;
  }
  pixPartsWrap.classList.remove("hidden");
  pixPartsWrap.innerHTML = arr
    .slice(1)
    .map((p) => {
      const title = `Parcela ${p.index || "?"}/${arr.length} — ${priceLine(p.amountCents || 0)}`;
      const img = p.qrCodeBase64
        ? (String(p.qrCodeBase64).startsWith("data:")
            ? String(p.qrCodeBase64)
            : `data:image/png;base64,${String(p.qrCodeBase64)}`)
        : String(p.qrcodeUrl || "");
      const text = String(p.copyPaste || "");
      return `<div class="rounded-2xl border border-border p-3 bg-muted/10">
        <p class="text-sm font-semibold text-foreground mb-2">${escapeHtml(title)}</p>
        <div class="flex justify-center mb-3">${img ? `<img alt="QR PIX parcela" src="${escapeHtml(img)}" class="w-40 h-40 rounded-lg border border-border bg-white object-contain" />` : ""}</div>
        <textarea readonly rows="3" class="w-full text-xs font-mono p-2 rounded-lg border border-border bg-white resize-none">${escapeHtml(text)}</textarea>
        <button type="button" class="chk-copy-part mt-2 w-full h-9 rounded-xl border border-primary/30 text-primary font-semibold text-sm hover:bg-primary/5" data-copy="${escapeHtml(text)}">Copiar parcela</button>
      </div>`;
    })
    .join("");
  pixPartsWrap.querySelectorAll(".chk-copy-part").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const t = btn.getAttribute("data-copy") || "";
      if (!t) return;
      try {
        await navigator.clipboard.writeText(t);
        btn.textContent = "Copiado!";
        setTimeout(() => {
          btn.textContent = "Copiar parcela";
        }, 1500);
      } catch {
        /* ignore */
      }
    });
  });
}

function updateSplitHint(parts, pixLimitCents) {
  if (!pixSplitHint) return;
  const arr = Array.isArray(parts) ? parts : [];
  if (arr.length <= 1) {
    pixSplitHint.classList.add("hidden");
    pixSplitHint.textContent = "";
    return;
  }
  const lim = Number.isFinite(Number(pixLimitCents)) ? priceLine(Number(pixLimitCents)) : "R$ 1.000,00";
  pixSplitHint.textContent = `Este pedido foi dividido em ${arr.length} PIX (limite de ${lim} por cobrança). Pague todas as parcelas para concluir.`;
  pixSplitHint.classList.remove("hidden");
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollStatus() {
  if (!externalId) return;
  try {
    const data = await api(`/api/checkout/order/${encodeURIComponent(externalId)}`);
    const st = data?.order?.status || "PENDENTE";
    const parts = data?.order?.checkout?.pixParts;
    if (statusEl) {
      if (st === "COMPLETO") {
        statusEl.textContent = "Pagamento confirmado. Obrigado!";
        statusEl.className =
          "text-center text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-xl py-3 px-4";
        stopPoll();
        clearCart();
      } else if (st === "FALHA" || st === "CANCELADO") {
        statusEl.textContent = `Estado do pagamento: ${st}`;
        statusEl.className =
          "text-center text-sm font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-xl py-3 px-4";
        stopPoll();
      } else {
        if (Array.isArray(parts) && parts.length > 1) {
          const done = parts.filter((p) => String(p?.status || "").toUpperCase() === "COMPLETO").length;
          statusEl.textContent = `Aguardando confirmação do PIX… (${done}/${parts.length} parcela(s) pagas)`;
        } else {
          statusEl.textContent = "Aguardando confirmação do PIX…";
        }
      }
    }
  } catch {
    /* ignorar */
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showErr("");
  const lines = getCartLines();
  if (!lines.length) {
    showErr("O carrinho está vazio.");
    return;
  }
  const payerName = String(
    /** @type {HTMLInputElement} */ (document.getElementById("chk-name"))?.value || ""
  ).trim();
  const payerDocument = digitsOnly(
    /** @type {HTMLInputElement} */ (document.getElementById("chk-doc"))?.value || ""
  );
  if (payerDocument.length !== 11) {
    showErr("CPF deve ter 11 dígitos.");
    return;
  }
  const checkout = {
    email: String(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-email"))?.value || ""
    ).trim(),
    phone: digitsOnly(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-phone"))?.value || ""
    ),
    cep: digitsOnly(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-cep"))?.value || ""
    ),
    street: String(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-street"))?.value || ""
    ).trim(),
    number: String(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-number"))?.value || ""
    ).trim(),
    complement: String(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-complement"))?.value || ""
    ).trim(),
    district: String(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-district"))?.value || ""
    ).trim(),
    city: String(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-city"))?.value || ""
    ).trim(),
    stateUf: String(
      /** @type {HTMLSelectElement} */ (document.getElementById("chk-state"))?.value || ""
    ).trim(),
    shippingInsurance: Boolean(insuranceCb?.checked),
    remarks: String(
      /** @type {HTMLTextAreaElement} */ (document.getElementById("chk-remarks"))?.value || ""
    ).trim(),
    couponCode: String(
      /** @type {HTMLInputElement} */ (document.getElementById("chk-coupon"))?.value || ""
    ).trim(),
  };

  const items = lines.map((l) => ({ slug: l.slug, qty: l.qty }));
  submitBtn.disabled = true;
  try {
    const res = await api("/api/checkout/pix", {
      method: "POST",
      body: JSON.stringify({ items, payerName, payerDocument, checkout }),
    });
    const cents =
      typeof res.grandTotalCents === "number"
        ? res.grandTotalCents
        : Math.round(Number(res.amountReais) * 100);
    showCheckoutPixStep({
      externalId: res.externalId,
      grandTotalCents: cents,
      copyPaste: res.copyPaste || "",
      qrCodeBase64: res.qrCodeBase64,
      qrcodeUrl: res.qrcodeUrl,
      pixParts: res.pixParts,
      pixLimitCents: res.pixLimitCents,
    });
  } catch (err) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String(/** @type {Error} */ (err).message)
        : "Não foi possível gerar o PIX.";
    showErr(msg);
  } finally {
    submitBtn.disabled = false;
  }
});

copyBtn?.addEventListener("click", async () => {
  const t = copyTa?.value || "";
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    if (copyBtn) copyBtn.textContent = "Copiado!";
    setTimeout(() => {
      if (copyBtn) copyBtn.textContent = "Copiar código PIX";
    }, 2000);
  } catch {
    copyTa?.select();
    document.execCommand("copy");
  }
});

(async function init() {
  await loadConfig();
  const resumed = await tryResumeOrderFromUrl();
  if (resumed) {
    initSocialProof();
    return;
  }
  const lines = getCartLines();
  if (!lines.length) {
    showErr("Carrinho vazio. Adicione produtos antes de finalizar.");
    form?.querySelectorAll("input,select,textarea,button").forEach((el) => {
      if (el !== submitBtn) (/** @type {HTMLInputElement} */ (el)).disabled = true;
    });
    if (submitBtn) submitBtn.disabled = true;
  }
  initSocialProof();
})();
