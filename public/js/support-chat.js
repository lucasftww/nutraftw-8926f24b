import { api } from "./util.js";

const root = document.createElement("div");
root.id = "support-chat-widget";
root.className = "fixed bottom-4 right-4 z-[95]";
root.innerHTML = `
  <button id="sc-open" type="button" class="h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg text-sm font-semibold inline-flex items-center gap-2 hover:shadow-xl transition-all">
    <span class="inline-flex w-2.5 h-2.5 rounded-full bg-white/90"></span>
    Suporte
  </button>
  <div id="sc-panel" class="hidden mt-2 w-[360px] max-w-[95vw] rounded-3xl border border-border/70 bg-white shadow-2xl overflow-hidden">
    <div class="px-4 py-3 border-b border-border bg-slate-50/80 flex items-center justify-between">
      <div>
        <strong class="text-sm text-foreground">Chat de suporte</strong>
        <p class="text-[11px] text-muted-foreground mt-0.5">Atendimento em horário comercial</p>
      </div>
      <button id="sc-close" type="button" class="text-xs text-muted-foreground hover:text-foreground font-medium">fechar</button>
    </div>
    <div id="sc-status" class="hidden px-4 py-2 text-xs border-b border-border bg-slate-50 text-slate-600"></div>
    <div id="sc-list" class="px-4 py-3 max-h-[300px] overflow-y-auto space-y-2 text-sm text-muted-foreground bg-gradient-to-b from-white to-slate-50/50"></div>
    <form id="sc-form" class="p-3 border-t border-border bg-white space-y-2">
      <div class="grid grid-cols-2 gap-2">
        <select id="sc-reason" class="h-10 px-2 rounded-xl border border-input bg-white text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
          <option value="">Motivo do contato</option>
          <option value="PEDIDO">Pedido</option>
          <option value="PAGAMENTO">Pagamento</option>
          <option value="ENTREGA">Entrega</option>
          <option value="PRODUTO">Produto</option>
          <option value="OUTRO">Outro</option>
        </select>
        <input id="sc-reason-detail" class="h-10 px-3 rounded-xl border border-input bg-white text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20" placeholder="Ex.: #pedido 123" />
      </div>
      <div class="flex gap-2">
        <input id="sc-input" class="flex-1 h-10 px-3 rounded-xl border border-input bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20" placeholder="Escreva a sua dúvida..." />
        <button class="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:shadow-md" type="submit">Enviar</button>
      </div>
    </form>
  </div>
`;
document.body.appendChild(root);

const panel = document.getElementById("sc-panel");
const list = document.getElementById("sc-list");
const input = document.getElementById("sc-input");
const reason = document.getElementById("sc-reason");
const reasonDetail = document.getElementById("sc-reason-detail");
const statusLine = document.getElementById("sc-status");
let currentChatId = null;
let currentChat = null;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function chatStatusText(st) {
  const s = String(st || "").toUpperCase();
  if (s === "RESOLVED") return "Resolvido";
  if (s === "CLOSED" || s === "AUTO_CLOSED") return "Fechado";
  return "Aberto";
}

function tsShort(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.length >= 16) return s.slice(0, 16).replace("T", " ");
  return s;
}

function updateStatusLine(chat) {
  if (!statusLine) return;
  if (!chat) {
    statusLine.classList.add("hidden");
    statusLine.textContent = "";
    return;
  }
  statusLine.classList.remove("hidden");
  const reasonText = String(chat.reason_category || "GERAL");
  statusLine.textContent = `Chamado #${chat.id} · ${chatStatusText(chat.status)} · motivo: ${reasonText}`;
}

async function loadMyChat() {
  const mine = await api("/api/support/chats/my");
  const chats = Array.isArray(mine.chats) ? mine.chats : [];
  const open = chats.find((c) => String(c.status || "").toUpperCase() === "OPEN");
  const first = open || chats[0] || null;
  currentChat = first;
  currentChatId = first ? first.id : null;
  return first;
}

async function refreshMessages() {
  if (!list) return;
  try {
    const chat = await loadMyChat();
    updateStatusLine(chat);
    const id = chat?.id || currentChatId;
    if (!id) {
      list.innerHTML = `<p>Envie a primeira mensagem para abrir um chamado com a equipa.</p>`;
      return;
    }
    const data = await api(`/api/support/chats/${encodeURIComponent(id)}/messages`);
    const rows = Array.isArray(data.messages) ? data.messages : [];
    if (!rows.length) {
      list.innerHTML = `<p>Olá! Envie a sua dúvida e a equipa responde no painel admin.</p>`;
      return;
    }
    list.innerHTML = rows
      .map((m) => {
        const me = String(m.sender_role || "").toUpperCase() !== "ADMIN";
        const when = tsShort(m.created_at);
        return `<div class="flex ${me ? "justify-end" : "justify-start"}">
          <div class="max-w-[84%] px-3 py-2 rounded-2xl shadow-sm ${me ? "bg-primary text-primary-foreground rounded-br-md" : "bg-white border border-border text-foreground rounded-bl-md"}">
            <p class="whitespace-pre-wrap break-words">${esc(m.body)}</p>
            ${when ? `<p class="text-[10px] mt-1 ${me ? "text-primary-foreground/75" : "text-muted-foreground"} text-right">${esc(when)}</p>` : ""}
          </div>
        </div>`;
      })
      .join("");
    list.scrollTop = list.scrollHeight;
  } catch (e) {
    list.innerHTML = `<p class="text-destructive">${esc(e?.message || "Erro no chat")}</p>`;
  }
}

document.getElementById("sc-open")?.addEventListener("click", async () => {
  panel?.classList.toggle("hidden");
  if (!panel?.classList.contains("hidden")) {
    await refreshMessages();
  }
});
document.getElementById("sc-close")?.addEventListener("click", () => {
  panel?.classList.add("hidden");
});

document.getElementById("sc-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = input?.value?.trim() || "";
  if (!body) return;
  try {
    let id = currentChatId;
    if (!id) {
      const reasonCategory = reason && "value" in reason ? String(reason.value || "").trim() : "";
      if (!reasonCategory) {
        alert("Selecione o motivo para abrir o chamado.");
        return;
      }
      const reasonText = reasonDetail && "value" in reasonDetail ? String(reasonDetail.value || "").trim() : "";
      const created = await api("/api/support/chats", {
        method: "POST",
        body: JSON.stringify({
          body,
          reasonCategory,
          reasonDetail: reasonText,
          subject: `${reasonCategory}${reasonText ? ` — ${reasonText}` : ""}`,
        }),
      });
      currentChat = created?.chat || null;
      id = created?.chat?.id || null;
      currentChatId = id;
    } else {
      await api(`/api/support/chats/${encodeURIComponent(id)}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    }
    if (input) input.value = "";
    await refreshMessages();
  } catch (e2) {
    alert(e2?.message || "Erro ao enviar");
  }
});

setInterval(() => {
  if (!panel?.classList.contains("hidden")) void refreshMessages();
}, 8000);
