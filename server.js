import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "node:fs";
import crypto from "node:crypto";
import express from "express";
import multer from "multer";
import session from "express-session";
import bcrypt from "bcryptjs";
import {
  openDb,
  findUserByEmail,
  createUserCustomer,
  listProductsActive,
  listProductsAll,
  listCategoriesActive,
  listCategoriesAll,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,
  insertPixOrder,
  getPixOrderByExternalId,
  getPixOrderByMpId,
  updatePixOrderStatus,
  cancelStalePendingPixOrders,
  updatePixOrderCheckoutMeta,
  listPixOrders,
  countPixOrders,
  pixOrdersStatusCounts,
  adminCatalogCounts,
  listProductsAllPaged,
  countProductsAllFiltered,
  listPixOrdersByCustomerEmail,
  getSiteSetting,
  setSiteSetting,
  deleteSiteSetting,
  addOrderTimelineEvent,
  getOrderLogistics,
  listOrderTimelineEvents,
  listOrderLogistics,
  listSupplierOrdersByExternalOrder,
  touchOnlineSession,
  trackVisitEvent,
  upsertOrderLogistics,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  createSupportChat,
  listSupportChats,
  getSupportChatById,
  addSupportMessage,
  listSupportMessages,
  updateSupportChatStatus,
  markSupportChatAdminRead,
  closeSupportChatsIdleNoCustomerReply,
} from "./db.js";
import { createPaySyncCharge, getPaySyncCharge } from "./paysync.js";
import { registerAdminOpsRoutes } from "./src/routes/admin-ops-routes.js";
import {
  appendOrderTimeline,
  processOrderAfterPayment,
  transitionOrderStatus,
} from "./src/services/order-workflow-service.js";
import { createLoggiService } from "./src/services/logistics/loggi-service.js";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3000;

await openDb();

/** PENDENTE → CANCELADO após N minutos sem pagamento (`.env`: `PIX_PENDING_EXPIRE_MINUTES`, padrão 40). */
const PIX_PENDING_EXPIRE_MINUTES = Math.max(
  1,
  Math.floor(Number(process.env.PIX_PENDING_EXPIRE_MINUTES) || 40)
);
const SUPPORT_CHAT_IDLE_CLOSE_MINUTES = Math.max(
  1,
  Math.floor(Number(process.env.SUPPORT_CHAT_IDLE_CLOSE_MINUTES) || 15)
);

let pixPendingExpiryLastTouchMs = 0;

function runPixPendingExpiryJob() {
  try {
    const n = cancelStalePendingPixOrders(PIX_PENDING_EXPIRE_MINUTES);
    if (n > 0) {
      console.log(
        `[pix] ${n} pedido(s) PENDENTE cancelado(s) por expiração (${PIX_PENDING_EXPIRE_MINUTES} min)`
      );
    }
    return n;
  } catch (e) {
    console.error("[pix] Erro ao expirar pedidos PENDENTE:", e);
    return 0;
  }
}

/** Até 1× / 15 s em rotas com polling, para não repetir o UPDATE em cada pedido. */
function maybeRunPixPendingExpiryJob() {
  const now = Date.now();
  if (now - pixPendingExpiryLastTouchMs < 15_000) return;
  pixPendingExpiryLastTouchMs = now;
  runPixPendingExpiryJob();
}

function runSupportChatsIdleCloseJob() {
  try {
    const n = closeSupportChatsIdleNoCustomerReply(
      SUPPORT_CHAT_IDLE_CLOSE_MINUTES
    );
    if (n > 0) {
      console.log(
        `[support] ${n} chat(s) fechados por falta de retorno do utilizador (${SUPPORT_CHAT_IDLE_CLOSE_MINUTES} min)`
      );
    }
    return n;
  } catch (e) {
    console.error("[support] Erro no auto-fecho de chats:", e);
    return 0;
  }
}

async function runLogisticsSyncJob() {
  try {
    const rows = listOrderLogistics(200);
    for (const row of rows) {
      const track = await loggiService.trackShipment(row.tracking_code || "");
      const next = String(track?.deliveryStatus || row.delivery_status || "");
      if (!next || next === row.delivery_status) continue;
      upsertOrderLogistics({
        externalOrderId: row.external_order_id,
        provider: row.provider,
        freightQuoteCents: row.freight_quote_cents,
        shipmentId: row.shipment_id,
        trackingCode: row.tracking_code,
        deliveryStatus: next,
        rawPayload: JSON.stringify(track?.raw || {}),
      });
      appendOrderTimeline(
        row.external_order_id,
        "logistics.tracking_update",
        "Atualização de rastreio",
        `Estado de entrega: ${next}`,
        { deliveryStatus: next }
      );
    }
  } catch (e) {
    console.error("[logistics] erro no sync:", e);
  }
}

const app = express();
app.disable("x-powered-by");
const loggiService = createLoggiService();

function isOrderPaidStatus(status) {
  const s = String(status || "").toUpperCase();
  return (
    s === "COMPLETO" ||
    s === "PAGO" ||
    s === "PREPARANDO_ENVIO" ||
    s === "AGUARDANDO_FORNECEDOR" ||
    s === "ENVIADO" ||
    s === "ENTREGUE"
  );
}

if (isProd || String(process.env.TRUST_PROXY || "").trim() === "1") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados pedidos. Tente novamente mais tarde." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de uploads por hora excedido." },
});

app.use(
  session({
    name: "kid",
    secret: process.env.SESSION_SECRET || "troque-em-producao-use-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: String(process.env.COOKIE_SECURE || "").trim() === "1",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

function detectDeviceType(ua) {
  const s = String(ua || "").toLowerCase();
  if (!s) return "unknown";
  if (s.includes("tablet") || s.includes("ipad")) return "tablet";
  if (s.includes("mobi") || s.includes("android")) return "mobile";
  return "desktop";
}

app.use((req, _res, next) => {
  try {
    const p = String(req.path || "");
    if (p.startsWith("/api/") || p.startsWith("/uploads/") || p.startsWith("/assets/")) {
      return next();
    }
    if (/\.[a-z0-9]+$/i.test(p)) return next();
    const sid = String(req.sessionID || "").trim();
    if (!sid) return next();
    const ua = String(req.headers["user-agent"] || "");
    const ip = String(req.ip || "");
    touchOnlineSession({
      sessionId: sid,
      path: p || "/",
      ip,
      userAgent: ua,
    });
    const accept = String(req.headers.accept || "");
    const isHtmlNav = req.method === "GET" && accept.includes("text/html");
    if (isHtmlNav) {
      trackVisitEvent({
        sessionId: sid,
        path: p || "/",
        referrer: String(req.headers.referer || ""),
        ip,
        userAgent: ua,
        deviceType: detectDeviceType(ua),
      });
    }
  } catch {
    /* ignore tracking errors */
  }
  next();
});

const publicDir = path.join(__dirname, "public");
const productUploadsDir = path.join(publicDir, "uploads", "products");

function ensureProductUploadsDir() {
  if (!fs.existsSync(productUploadsDir)) {
    fs.mkdirSync(productUploadsDir, { recursive: true });
  }
}

function extFromImageMime(mimetype) {
  const m = String(mimetype || "").toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  return "";
}

const productImageMulter = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        ensureProductUploadsDir();
        cb(null, productUploadsDir);
      } catch (e) {
        cb(e instanceof Error ? e : new Error(String(e)));
      }
    },
    filename: (_req, file, cb) => {
      const ext = extFromImageMime(file.mimetype);
      if (!ext) return cb(new Error("Tipo de imagem inválido"));
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (extFromImageMime(file.mimetype)) cb(null, true);
    else cb(new Error("Só são aceites imagens JPEG, PNG, WebP ou GIF."));
  },
});

function requireAdmin(req, res, next) {
  if (req.session?.userId && req.session?.role === "admin") return next();
  return res.status(401).json({ error: "Não autorizado" });
}

function sessionPermissions(req) {
  const p = req.session?.permissions;
  if (!Array.isArray(p)) return [];
  return p.map((x) => String(x || "").trim()).filter(Boolean);
}

function hasPermission(req, perm) {
  const pp = sessionPermissions(req);
  return pp.includes("*") || pp.includes(String(perm || ""));
}

function requireAdminPerm(perm) {
  return (req, res, next) => {
    if (!req.session?.userId || req.session?.role !== "admin") {
      return res.status(401).json({ error: "Não autorizado" });
    }
    if (!hasPermission(req, perm)) {
      return res.status(403).json({ error: "Sem permissão para esta operação." });
    }
    return next();
  };
}

function requireCustomer(req, res, next) {
  if (req.session?.userId && req.session?.role === "customer") return next();
  return res.status(401).json({ error: "Inicie sessão como cliente." });
}

function sessionCustomerEmail(req) {
  return String(req.session?.email || "").trim().toLowerCase();
}

function customerOwnsPixOrderEmail(email, row) {
  const em = String(email || "").trim().toLowerCase();
  const owner = String(row.customer_email || "").trim().toLowerCase();
  let metaEmail = "";
  try {
    metaEmail = String(
      JSON.parse(String(row.checkout_meta || "{}")).email || ""
    )
      .trim()
      .toLowerCase();
  } catch {
    metaEmail = "";
  }
  return owner === em || metaEmail === em;
}

/** True se alguma parcela PIX em checkout_meta está COMPLETA. */
function pixCheckoutHasPaidPart(checkoutMetaJson) {
  let meta = {};
  try {
    meta = JSON.parse(String(checkoutMetaJson || "{}"));
  } catch {
    return false;
  }
  const parts = Array.isArray(meta.pixParts) ? meta.pixParts : [];
  if (!parts.length) return false;
  return parts.some((p) => normalizePixStatus(p?.status) === "COMPLETO");
}

/** Resumo seguro para lista na área do cliente */
function customerOrderSummaryFromRow(r) {
  let checkout = {};
  /** @type {unknown[]} */
  let lines = [];
  try {
    checkout = JSON.parse(String(r.checkout_meta || "{}"));
  } catch {
    checkout = {};
  }
  try {
    lines = JSON.parse(String(r.lines_json || "[]"));
  } catch {
    lines = [];
  }
  const parts = Array.isArray(checkout.pixParts) ? checkout.pixParts : [];
  let partsPaid = 0;
  for (const p of parts) {
    if (normalizePixStatus(p?.status) === "COMPLETO") partsPaid += 1;
  }
  const partsTotal = Math.max(parts.length, 1);
  const qtySum = lines.reduce((n, x) => {
    const q = x && typeof x === "object" ? Number(/** @type {{qty?:number}} */ (x).qty) : 0;
    return n + (Number.isFinite(q) ? q : 0);
  }, 0);

  const partsPaidOut =
    parts.length > 0 ? partsPaid : r.status === "COMPLETO" ? 1 : 0;

  return {
    externalId: r.external_id,
    status: r.status,
    amountCents: r.amount_cents,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    payerName: r.payer_name,
    itemCount: qtySum,
    lineTitles: lines
      .slice(0, 4)
      .map((x) =>
        x && typeof x === "object" ? String((/** @type {{name?:string}} */ (x)).name || "") : ""
      )
      .filter(Boolean),
    shipping: {
      city: checkout.city ? String(checkout.city) : "",
      stateUf: checkout.stateUf ? String(checkout.stateUf) : "",
      cep: checkout.cep != null ? digitsOnly(checkout.cep) : "",
    },
    pix: {
      split: Boolean(checkout.pixSplit || parts.length > 1),
      partsTotal,
      partsPaid: partsPaidOut,
    },
  };
}

/** Etapas fixas para acompanhamento objetivo no detalhe */
function buildCustomerTimeline(order) {
  const createdAt = order.createdAt || "";
  const updatedAt = order.updatedAt || "";
  let checkout = order.checkout || {};
  const parts = Array.isArray(checkout.pixParts) ? checkout.pixParts : [];
  let aggregatePaid = order.status === "COMPLETO";
  if (parts.length > 0) {
    aggregatePaid = parts.every(
      (p) => normalizePixStatus(p?.status) === "COMPLETO"
    );
  }
  return [
    {
      key: "created",
      title: "Pedido registado",
      detail: "Recebemos os dados do checkout e os itens do carrinho.",
      at: createdAt,
      done: true,
    },
    {
      key: "payment",
      title: "Pagamento PIX",
      detail: aggregatePaid
        ? "Pagamento confirmado."
        : parts.length > 1
          ? `Parcelas PIX: ${parts.filter((p) => normalizePixStatus(p?.status) === "COMPLETO").length} de ${parts.length} confirmadas.`
          : "Aguardando confirmação do pagamento.",
      at: aggregatePaid ? updatedAt : null,
      done: aggregatePaid,
    },
    {
      key: "fulfillment",
      title: "Separação e envio",
      detail:
        aggregatePaid
          ? "Pedido em processamento para envio. Consulte aqui por atualizações."
          : "Esta etapa inicia após a confirmação do PIX.",
      at: null,
      done: false,
    },
  ];
}

registerAdminOpsRoutes(app, requireAdmin);

app.post("/api/auth/register", loginLimiter, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha obrigatórios" });
  }
  try {
    const user = createUserCustomer({ email, password });
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.email = user.email;
    return res.status(201).json({
      ok: true,
      email: user.email,
      role: user.role,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (
      msg.includes("Email inválido") ||
      msg.includes("senha") ||
      msg.includes("Senha")
    ) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes("já está registado")) {
      return res.status(409).json({ error: msg });
    }
    console.error(e);
    return res.status(500).json({ error: "Erro ao criar conta" });
  }
});

app.post("/api/login", loginLimiter, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha obrigatórios" });
  }
  const user = findUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.email = user.email;
  let permissions = [];
  try {
    permissions = JSON.parse(String(user.permissions_json || "[]"));
    if (!Array.isArray(permissions)) permissions = [];
  } catch {
    permissions = [];
  }
  if (user.role === "admin" && !permissions.length) permissions = ["*"];
  req.session.permissions = permissions;
  return res.json({
    ok: true,
    email: user.email,
    role: user.role,
    permissions,
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("kid");
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session?.userId) return res.json({ user: null });
  res.json({
    user: {
      id: req.session.userId,
      email: req.session.email,
      role: req.session.role,
      permissions: sessionPermissions(req),
    },
  });
});

app.get("/api/me/orders", requireCustomer, (req, res) => {
  try {
    maybeRunPixPendingExpiryJob();
    const email = sessionCustomerEmail(req);
    const rows = listPixOrdersByCustomerEmail(email);
    const orders = rows.map(customerOrderSummaryFromRow);
    res.json({ orders });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar pedidos" });
  }
});

app.post("/api/me/orders/:externalId/cancel", requireCustomer, (req, res) => {
  try {
    maybeRunPixPendingExpiryJob();
    const externalId = String(req.params.externalId || "").trim();
    if (!externalId) return res.status(400).json({ error: "ID inválido" });
    const email = sessionCustomerEmail(req);
    const row = getPixOrderByExternalId(externalId);
    if (!row || !customerOwnsPixOrderEmail(email, row)) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }
    const st = String(row.status || "").trim().toUpperCase();
    if (st !== "PENDENTE") {
      return res.status(400).json({
        error: "Só é possível cancelar pedidos com pagamento pendente.",
      });
    }
    if (pixCheckoutHasPaidPart(row.checkout_meta)) {
      return res.status(400).json({
        error:
          "Não é possível cancelar: já existe parcela PIX paga neste pedido.",
      });
    }
    updatePixOrderStatus(externalId, "CANCELADO");
    res.json({ ok: true, status: "CANCELADO" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao cancelar pedido" });
  }
});

app.get("/api/me/orders/:externalId", requireCustomer, async (req, res) => {
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "ID inválido" });
  const email = sessionCustomerEmail(req);
  const row = getPixOrderByExternalId(externalId);
  if (!row || !customerOwnsPixOrderEmail(email, row)) {
    return res.status(404).json({ error: "Pedido não encontrado" });
  }
  try {
    const payload = await getOrderPayloadByExternalId(externalId);
    if (!payload?.order) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }
    const timeline = buildCustomerTimeline(payload.order);
    res.json({ order: payload.order, timeline });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar pedido" });
  }
});

app.post("/api/support/chats", (req, res) => {
  try {
    req.session.support_guest = 1;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const text = String(body.body || "").trim();
    if (!text) {
      return res
        .status(400)
        .json({ error: "Escreva uma mensagem para abrir o chamado." });
    }
    const reasonCategory = String(body.reasonCategory || "")
      .trim()
      .toUpperCase()
      .slice(0, 80);
    if (!reasonCategory) {
      return res.status(400).json({ error: "Selecione o motivo do contato." });
    }
    const reasonDetail = String(body.reasonDetail || "").trim().slice(0, 240);
    const subject = String(body.subject || reasonCategory)
      .trim()
      .slice(0, 240);
    const customerEmail =
      req.session?.role === "customer"
        ? String(req.session?.email || "").trim().toLowerCase()
        : "";
    const chat = createSupportChat({
      customerEmail,
      customerSessionId: String(req.sessionID || ""),
      subject,
      reasonCategory,
      reasonDetail,
    });
    const message = addSupportMessage({
      chatId: chat.id,
      senderRole: "CUSTOMER",
      senderEmail: customerEmail,
      body: text,
    });
    res.status(201).json({ chat: getSupportChatById(chat.id), message });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao abrir chat" });
  }
});

app.get("/api/support/chats/my", (req, res) => {
  try {
    req.session.support_guest = 1;
    const sid = String(req.sessionID || "");
    const email =
      req.session?.role === "customer"
        ? String(req.session?.email || "").trim().toLowerCase()
        : "";
    const rows = listSupportChats({ limit: 100, offset: 0, status: "" }).filter(
      (x) =>
        String(x.customer_session_id || "") === sid ||
        (email && String(x.customer_email || "").toLowerCase() === email)
    );
    res.json({ chats: rows });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao listar chats" });
  }
});

app.get("/api/support/chats/:id/messages", (req, res) => {
  try {
    const chatId = Math.floor(Number(req.params.id));
    const chat = getSupportChatById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });
    const sid = String(req.sessionID || "");
    const email =
      req.session?.role === "customer"
        ? String(req.session?.email || "").trim().toLowerCase()
        : "";
    const isAdmin = req.session?.role === "admin";
    const owner =
      String(chat.customer_session_id || "") === sid ||
      (email && String(chat.customer_email || "").toLowerCase() === email);
    if (!isAdmin && !owner) return res.status(403).json({ error: "Sem acesso ao chat." });
    res.json({ chat, messages: listSupportMessages(chatId) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao carregar chat" });
  }
});

app.post("/api/support/chats/:id/messages", (req, res) => {
  try {
    const chatId = Math.floor(Number(req.params.id));
    const chat = getSupportChatById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });
    const sid = String(req.sessionID || "");
    const email =
      req.session?.role === "customer"
        ? String(req.session?.email || "").trim().toLowerCase()
        : "";
    const isAdmin = req.session?.role === "admin";
    const owner =
      String(chat.customer_session_id || "") === sid ||
      (email && String(chat.customer_email || "").toLowerCase() === email);
    if (!isAdmin && !owner) return res.status(403).json({ error: "Sem acesso ao chat." });
    const senderRole = isAdmin ? "ADMIN" : "CUSTOMER";
    const senderEmail = isAdmin
      ? String(req.session?.email || "")
      : String(chat.customer_email || "");
    const message = addSupportMessage({
      chatId,
      senderRole,
      senderEmail,
      body: req.body?.body || "",
    });
    res.status(201).json({ message });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao enviar mensagem" });
  }
});

app.get("/api/products", (_req, res) => {
  try {
    const rows = listProductsActive();
    res.json({ products: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
});

app.get("/api/categories", (_req, res) => {
  try {
    res.json({ categories: listCategoriesActive() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
});

app.get("/api/catalog", (_req, res) => {
  try {
    res.json({
      categories: listCategoriesActive(),
      products: listProductsActive(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar catálogo" });
  }
});

app.get("/api/products/slug/:slug", (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Slug inválido" });
    const row = getProductBySlug(slug);
    if (!row) return res.status(404).json({ error: "Produto não encontrado" });
    res.json({ product: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar produto" });
  }
});

function publicBaseUrl() {
  const u = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (u) return u;
  return `http://127.0.0.1:${PORT}`;
}

function paysyncApiKey() {
  return String(process.env.PAYSYNC_API_KEY || "").trim();
}

/** Estados PaySync → estados internos do pedido (pix_orders). */
function paySyncChargeStatusToApp(raw) {
  const u = String(raw || "").trim().toLowerCase();
  if (u === "paid") return "COMPLETO";
  if (u === "pending") return "PENDENTE";
  if (u === "expired") return "CANCELADO";
  if (u === "refunded") return "FALHA";
  return "PENDENTE";
}

/** callbackUrl exige HTTPS na PaySync; em http://127.0.0.1 omite-se (confirmação por polling). */
function paysyncCallbackUrl() {
  const base = publicBaseUrl().replace(/\/$/, "");
  if (!base.startsWith("https://")) return undefined;
  const token = String(process.env.PAYSYNC_WEBHOOK_TOKEN || "").trim();
  const path = "/api/webhooks/paysync";
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${base}${path}${q}`;
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function normalizePixStatus(raw) {
  const st = String(raw || "").trim().toUpperCase();
  if (!st) return "PENDENTE";
  if (st === "PAID") return "COMPLETO";
  return st;
}

function aggregatePixPartsStatus(parts = []) {
  const arr = Array.isArray(parts) ? parts : [];
  if (!arr.length) return "PENDENTE";
  const statuses = arr.map((p) => normalizePixStatus(p?.status));
  if (statuses.every((s) => s === "COMPLETO")) return "COMPLETO";
  if (statuses.some((s) => s === "PENDENTE")) return "PENDENTE";
  if (statuses.every((s) => s === "FALHA" || s === "CANCELADO")) return "FALHA";
  return "PENDENTE";
}

function findOrderByPixPartTransactionId(transactionId) {
  const tid = String(transactionId || "").trim();
  if (!tid) return null;
  const rows = listPixOrders({ limit: 5000, offset: 0, status: null });
  for (const row of rows) {
    let meta = {};
    try {
      meta = JSON.parse(String(row.checkout_meta || "{}"));
    } catch {
      meta = {};
    }
    const parts = Array.isArray(meta.pixParts) ? meta.pixParts : [];
    if (
      parts.some((p) => {
        const a = String(p?.mpTransactionId || "").trim();
        const b = String(p?.transactionId || "").trim();
        return a === tid || b === tid;
      })
    ) {
      return row;
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>} fresh
 */
function parseOrderRowFromDb(fresh) {
  let lines = [];
  try {
    lines = JSON.parse(String(fresh.lines_json || "[]"));
  } catch {
    lines = [];
  }
  let checkout = {};
  try {
    checkout = JSON.parse(String(fresh.checkout_meta || "{}"));
  } catch {
    checkout = {};
  }
  return {
    externalId: fresh.external_id,
    mpTransactionId: fresh.mp_transaction_id,
    status: fresh.status,
    amountCents: fresh.amount_cents,
    payerName: fresh.payer_name,
    payerDocument: fresh.payer_document,
    lines,
    checkout,
    createdAt: fresh.created_at,
    updatedAt: fresh.updated_at,
  };
}

async function ensureLogisticsForOrder(externalId) {
  const oid = String(externalId || "").trim();
  if (!oid) return null;
  const row = getPixOrderByExternalId(oid);
  if (!row) return null;
  let checkout = {};
  try {
    checkout = JSON.parse(String(row.checkout_meta || "{}"));
  } catch {
    checkout = {};
  }
  const quote = await loggiService.quoteFreight({ ...row, checkout });
  const ship = await loggiService.createShipment({ ...row, checkout });
  const saved = upsertOrderLogistics({
    externalOrderId: oid,
    provider: quote?.provider || ship?.provider || "mock-loggi",
    freightQuoteCents: Number(quote?.quotedCents || 0),
    shipmentId: String(ship?.shipmentId || ""),
    trackingCode: String(ship?.trackingCode || ""),
    deliveryStatus: String(ship?.status || "aguardando_coleta"),
    rawPayload: JSON.stringify({ quote, shipment: ship }),
  });
  appendOrderTimeline(
    oid,
    "logistics.created",
    "Envio criado",
    `Envio registado no provedor ${saved?.provider || "logística"}.`,
    { trackingCode: saved?.tracking_code || "" }
  );
  return saved;
}

async function getOrderPayloadByExternalId(externalId) {
  const id = String(externalId || "").trim();
  if (!id) return null;
  maybeRunPixPendingExpiryJob();
  const row = getPixOrderByExternalId(id);
  if (!row) return null;
  let check = null;
  const apiKey = paysyncApiKey();
  let checkoutMeta = {};
  try {
    checkoutMeta = JSON.parse(String(row.checkout_meta || "{}"));
  } catch {
    checkoutMeta = {};
  }
  const parts = Array.isArray(checkoutMeta.pixParts) ? checkoutMeta.pixParts : [];
  if (apiKey && row.status === "PENDENTE" && row.mp_transaction_id) {
    try {
      const payId = String(row.mp_transaction_id || "").trim();
      const data = await getPaySyncCharge({ apiKey, paymentId: payId });
      check = data;
      const st = paySyncChargeStatusToApp(data?.status);
      let metaChanged = false;
      for (const part of parts) {
        const pid = String(part?.mpTransactionId || "").trim();
        if (pid === payId && normalizePixStatus(part?.status) !== st) {
          part.status = st;
          metaChanged = true;
        }
      }
      if (metaChanged && parts.length) {
        checkoutMeta.pixParts = parts;
        updatePixOrderCheckoutMeta(id, JSON.stringify(checkoutMeta));
      }
      if (st && st !== row.status) {
        transitionOrderStatus(
          id,
          st,
          "Atualização automática de estado pelo gateway PaySync",
          { source: "polling", gatewayStatus: data?.status || null }
        );
        if (st === "COMPLETO" && !isOrderPaidStatus(row.status)) {
          processOrderAfterPayment(id, "system");
          await ensureLogisticsForOrder(id);
        }
      }
    } catch (e) {
      console.error("checkout/status:", e instanceof Error ? e.message : e);
    }
  }
  const fresh = getPixOrderByExternalId(id) || row;
  return {
    order: parseOrderRowFromDb(fresh),
    check,
    timeline: listOrderTimelineEvents(id),
    logistics: getOrderLogistics(id),
    supplierOrders: listSupplierOrdersByExternalOrder(id),
  };
}

const BR_UF = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const EMAIL_RE_CHECKOUT =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function freightPadraoCents() {
  const raw = getSiteSetting("freight_padrao_cents", "").trim();
  if (raw !== "") {
    const dbN = Math.floor(Number(raw));
    if (Number.isFinite(dbN) && dbN >= 0) return dbN;
  }
  const n = Math.floor(Number(process.env.FREIGHT_PADRAO_CENTS));
  return Number.isFinite(n) && n >= 0 ? n : 8000;
}

/** Valor guardado na BD (null = usa env / fallback). */
function freightPadraoCentsStored() {
  const raw = getSiteSetting("freight_padrao_cents", "").trim();
  if (raw === "") return null;
  const dbN = Math.floor(Number(raw));
  return Number.isFinite(dbN) && dbN >= 0 ? dbN : null;
}

function checkoutFreightLabel() {
  const v = getSiteSetting("freight_label", "").trim();
  return v || "Frete (Padrão)";
}

function checkoutFreightEta() {
  const v = getSiteSetting("freight_eta", "").trim();
  return v || "7 a 10 dias úteis";
}

app.get("/api/checkout/config", (_req, res) => {
  res.json({
    freightPadraoCents: freightPadraoCents(),
    freightLabel: checkoutFreightLabel(),
    freightEta: checkoutFreightEta(),
    insurancePercent: 10,
  });
});

/**
 * POST { items, payerName, payerDocument, checkout: { email, phone, cep, street, number, complement, district, city, stateUf, shippingInsurance, remarks, couponCode? } }
 * Totais recalculados no servidor (subtotal + frete + seguro opcional).
 */
app.post("/api/checkout/pix", async (req, res) => {
  const apiKey = paysyncApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error:
        "PIX não configurado. Defina PAYSYNC_API_KEY no ambiente (chave ps_live_ ou ps_test_).",
    });
  }
  const payerName = String(req.body?.payerName || "").trim().slice(0, 120);
  const payerDocument = digitsOnly(req.body?.payerDocument);
  const items = req.body?.items;
  const ch = req.body?.checkout && typeof req.body.checkout === "object"
    ? req.body.checkout
    : {};

  if (!payerName || payerDocument.length !== 11) {
    return res
      .status(400)
      .json({ error: "Nome e CPF válido (11 dígitos) são obrigatórios." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Carrinho vazio ou inválido." });
  }

  const email = String(ch.email || "").trim().toLowerCase().slice(0, 120);
  const phone = digitsOnly(ch.phone);
  const cep = digitsOnly(ch.cep);
  const street = String(ch.street || "").trim().slice(0, 200);
  const number = String(ch.number || "").trim().slice(0, 20);
  const complement = String(ch.complement || "").trim().slice(0, 120);
  const district = String(ch.district || "").trim().slice(0, 120);
  const city = String(ch.city || "").trim().slice(0, 120);
  const stateUf = String(ch.stateUf || "").trim().toUpperCase().slice(0, 2);
  const shippingInsurance = Boolean(ch.shippingInsurance);
  const remarks = String(ch.remarks || "").trim().slice(0, 500);
  const couponCode = String(ch.couponCode || "").trim().slice(0, 40);

  if (!EMAIL_RE_CHECKOUT.test(email)) {
    return res.status(400).json({ error: "E-mail inválido." });
  }
  if (phone.length < 10 || phone.length > 13) {
    return res.status(400).json({ error: "Telefone (WhatsApp) inválido." });
  }
  if (cep.length !== 8) {
    return res.status(400).json({ error: "CEP deve ter 8 dígitos." });
  }
  if (!street || !number || !district || !city) {
    return res.status(400).json({ error: "Preencha rua, número, bairro e cidade." });
  }
  if (!BR_UF.has(stateUf)) {
    return res.status(400).json({ error: "UF inválida." });
  }

  /** @type {{ slug: string; name: string; price_cents: number; qty: number }[]} */
  const lines = [];
  let subtotalCents = 0;
  for (const raw of items) {
    const slug = String(raw?.slug || "").trim();
    const qty = Math.floor(Number(raw?.qty));
    if (!slug || !Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ error: "Item inválido no carrinho." });
    }
    const p = getProductBySlug(slug);
    if (!p) {
      return res.status(400).json({ error: `Produto indisponível: ${slug}` });
    }
    const price = Math.max(0, Math.round(Number(p.price_cents) || 0));
    lines.push({
      slug: p.slug,
      name: p.name,
      price_cents: price,
      qty,
    });
    subtotalCents += price * qty;
  }
  if (subtotalCents < 1) {
    return res.status(400).json({ error: "Total do pedido inválido." });
  }

  const freightCents = freightPadraoCents();
  const insuranceCents = shippingInsurance
    ? Math.round(subtotalCents * 0.1)
    : 0;
  const grandTotalCents = subtotalCents + freightCents + insuranceCents;
  if (grandTotalCents < 100) {
    return res.status(400).json({
      error: "Valor mínimo do pedido é R$ 1,00 (exigência do gateway PaySync).",
    });
  }

  const externalId = `loja-${crypto.randomUUID()}`;
  const description = `Pedido ${externalId} — ${lines.length} tipo(s) — PIX`;
  const callbackUrl = paysyncCallbackUrl();

  const checkoutMeta = {
    email,
    phone,
    cep,
    street,
    number,
    complement,
    district,
    city,
    stateUf,
    freightType: "padrao",
    freightCents,
    shippingInsurance,
    insuranceCents,
    subtotalCents,
    grandTotalCents,
    remarks,
    couponCode: couponCode || null,
  };

  try {
    const charge = await createPaySyncCharge({
      apiKey,
      valueCents: grandTotalCents,
      description,
      callbackUrl,
      customer: {
        name: payerName,
        email,
        externalId,
      },
      metadata: JSON.stringify({ externalId, source: "gimports-checkout" }),
    });
    const paymentId = String(charge?.paymentId || "").trim();
    const pix = charge?.pix && typeof charge.pix === "object" ? charge.pix : {};
    const brCode = String(pix.brCode || "");
    const qrCodeImage = String(pix.qrCodeImage || "");
    if (!paymentId || !brCode) {
      console.error("Resposta PaySync inesperada:", charge);
      return res.status(502).json({ error: "Resposta inválida do gateway." });
    }
    const amountReais = Number((grandTotalCents / 100).toFixed(2));
    const partStatus = paySyncChargeStatusToApp(charge?.status || "pending");
    const pixParts = [
      {
        index: 1,
        amountCents: grandTotalCents,
        amountReais,
        transactionId: externalId,
        mpTransactionId: paymentId,
        copyPaste: brCode,
        qrcodeUrl: qrCodeImage,
        qrCodeBase64: "",
        status: partStatus,
      },
    ];
    checkoutMeta.pixParts = pixParts;
    checkoutMeta.pixSplit = false;
    checkoutMeta.paySync = { provider: "paysync", paymentId };
    insertPixOrder({
      external_id: externalId,
      mp_transaction_id: paymentId,
      amount_cents: grandTotalCents,
      payer_name: payerName,
      payer_document: payerDocument,
      lines_json: JSON.stringify(lines),
      checkout_meta: JSON.stringify(checkoutMeta),
    });
    appendOrderTimeline(
      externalId,
      "order.created",
      "Pedido registado",
      "Pedido criado e aguardando pagamento PIX.",
      { gateway: "paysync", paymentId }
    );
    const firstPart = pixParts[0];
    return res.json({
      ok: true,
      externalId,
      mpTransactionId: paymentId,
      copyPaste: firstPart.copyPaste || "",
      qrcodeUrl: firstPart.qrcodeUrl || "",
      qrCodeBase64: firstPart.qrCodeBase64 || "",
      pixParts,
      amountReais,
      subtotalCents,
      freightCents,
      insuranceCents,
      grandTotalCents,
      status: aggregatePixPartsStatus(pixParts),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar PIX";
    console.error("checkout/pix:", msg);
    return res.status(400).json({ error: msg });
  }
});

app.get("/api/checkout/order/:externalId", async (req, res) => {
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "ID inválido" });
  const payload = await getOrderPayloadByExternalId(externalId);
  if (!payload) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(payload);
});

app.post("/api/webhooks/paysync", async (req, res) => {
  const token = String(process.env.PAYSYNC_WEBHOOK_TOKEN || "").trim();
  if (token) {
    const q = String(req.query?.token || "");
    if (q !== token) return res.status(401).json({ error: "Unauthorized" });
  }
  const body = req.body || {};
  const event = String(body.event || "");
  const paymentId = String(body.paymentId || "").trim();
  if (!paymentId) {
    return res.status(400).json({ error: "Payload inválido" });
  }
  let appStatus = "";
  if (event === "payment.paid") {
    appStatus = "COMPLETO";
  } else if (body.status) {
    appStatus = paySyncChargeStatusToApp(body.status);
  } else {
    return res.json({ ok: true });
  }
  const order = getPixOrderByMpId(paymentId) || findOrderByPixPartTransactionId(paymentId);
  if (order) {
    let meta = {};
    try {
      meta = JSON.parse(String(order.checkout_meta || "{}"));
    } catch {
      meta = {};
    }
    const parts = Array.isArray(meta.pixParts) ? meta.pixParts : [];
    let changed = false;
    for (const p of parts) {
      const mpTid = String(p?.mpTransactionId || "").trim();
      if (mpTid === paymentId) {
        p.status = appStatus;
        changed = true;
      }
    }
    if (changed && parts.length) {
      meta.pixParts = parts;
      updatePixOrderCheckoutMeta(order.external_id, JSON.stringify(meta));
    }
    if (appStatus && appStatus !== order.status) {
      transitionOrderStatus(
        order.external_id,
        appStatus,
        "Atualização recebida via webhook PaySync",
        { source: "webhook", event, paymentId }
      );
      if (appStatus === "COMPLETO" && !isOrderPaidStatus(order.status)) {
        processOrderAfterPayment(order.external_id, "system");
        await ensureLogisticsForOrder(order.external_id);
      }
    }
  }
  res.json({ ok: true });
});

app.get("/api/admin/stats", requireAdminPerm("dashboard"), (_req, res) => {
  try {
    maybeRunPixPendingExpiryJob();
    const catalog = adminCatalogCounts();
    const byStatus = pixOrdersStatusCounts();
    const ordersTotal = countPixOrders();
    res.json({
      catalog,
      ordersTotal,
      ordersByStatus: byStatus.map((r) => ({
        status: r.status,
        count: Number(r.n || 0),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar estatísticas" });
  }
});

app.get("/api/admin/users", requireAdminPerm("manage_admins"), (_req, res) => {
  try {
    const users = listAdminUsers().map((u) => {
      let perms = [];
      try {
        perms = JSON.parse(String(u.permissions_json || "[]"));
      } catch {
        perms = [];
      }
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        permissions: Array.isArray(perms) ? perms : [],
        createdAt: u.created_at,
      };
    });
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao listar admins" });
  }
});

app.post("/api/admin/users", requireAdminPerm("manage_admins"), (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const user = createAdminUser({
      email: body.email,
      password: body.password,
      permissions: body.permissions,
    });
    let permissions = [];
    try {
      permissions = JSON.parse(String(user.permissions_json || "[]"));
    } catch {
      permissions = [];
    }
    res.status(201).json({
      user: { id: user.id, email: user.email, role: user.role, permissions },
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao criar admin" });
  }
});

app.put("/api/admin/users/:id", requireAdminPerm("manage_admins"), (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const user = updateAdminUser(req.params.id, body);
    if (!user) return res.status(404).json({ error: "Admin não encontrado" });
    let permissions = [];
    try {
      permissions = JSON.parse(String(user.permissions_json || "[]"));
    } catch {
      permissions = [];
    }
    res.json({
      user: { id: user.id, email: user.email, role: user.role, permissions },
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao atualizar admin" });
  }
});

app.get("/api/admin/support/chats", requireAdminPerm("support"), (req, res) => {
  try {
    runSupportChatsIdleCloseJob();
    const status = String(req.query.status || "").trim();
    const chats = listSupportChats({ status, limit: 200, offset: 0 });
    res.json({ chats });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao listar chats" });
  }
});

app.get("/api/admin/support/chats/:id", requireAdminPerm("support"), (req, res) => {
  try {
    const id = Math.floor(Number(req.params.id));
    const chat = getSupportChatById(id);
    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });
    markSupportChatAdminRead(id);
    res.json({ chat: getSupportChatById(id), messages: listSupportMessages(id) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao carregar chat" });
  }
});

app.post("/api/admin/support/chats/:id/reply", requireAdminPerm("support"), (req, res) => {
  try {
    const id = Math.floor(Number(req.params.id));
    const chat = getSupportChatById(id);
    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });
    const msg = addSupportMessage({
      chatId: id,
      senderRole: "ADMIN",
      senderEmail: String(req.session?.email || ""),
      body: req.body?.body || "",
    });
    if (String(chat.status || "").toUpperCase() !== "OPEN") {
      updateSupportChatStatus(id, "OPEN");
    }
    res.status(201).json({ message: msg });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao responder chat" });
  }
});

app.put("/api/admin/support/chats/:id/status", requireAdminPerm("support"), (req, res) => {
  try {
    const id = Math.floor(Number(req.params.id));
    const chat = getSupportChatById(id);
    if (!chat) return res.status(404).json({ error: "Chat não encontrado" });
    const next = String(req.body?.status || "OPEN").trim().toUpperCase();
    const allowed = new Set(["OPEN", "CLOSED", "RESOLVED", "AUTO_CLOSED"]);
    if (!allowed.has(next)) {
      return res.status(400).json({ error: "Status inválido para chat." });
    }
    updateSupportChatStatus(id, next);
    res.json({ ok: true, status: next });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro ao atualizar chat" });
  }
});

app.get("/api/admin/site-settings", requireAdminPerm("settings"), (_req, res) => {
  try {
    res.json({
      freightEta: checkoutFreightEta(),
      freightLabel: checkoutFreightLabel(),
      freightPadraoCents: freightPadraoCents(),
      freightPadraoCentsStored: freightPadraoCentsStored(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao carregar definições" });
  }
});

app.put("/api/admin/site-settings", requireAdminPerm("settings"), (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.freightEta != null) {
      setSiteSetting("freight_eta", String(body.freightEta).trim().slice(0, 300));
    }
    if (body.freightLabel != null) {
      setSiteSetting(
        "freight_label",
        String(body.freightLabel).trim().slice(0, 160)
      );
    }
    if (body.freightPadraoCents !== undefined) {
      if (
        body.freightPadraoCents === "" ||
        body.freightPadraoCents === null
      ) {
        deleteSiteSetting("freight_padrao_cents");
      } else {
        const n = Math.floor(Number(body.freightPadraoCents));
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: "Valor do frete inválido." });
        }
        setSiteSetting("freight_padrao_cents", String(n));
      }
    }
    res.json({
      ok: true,
      freightEta: checkoutFreightEta(),
      freightLabel: checkoutFreightLabel(),
      freightPadraoCents: freightPadraoCents(),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao guardar definições" });
  }
});

app.get("/api/admin/orders", requireAdminPerm("orders.read"), (req, res) => {
  try {
    maybeRunPixPendingExpiryJob();
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const pageSize = Math.min(100, Math.max(5, Math.floor(Number(req.query.pageSize) || 25)));
    const status = req.query.status != null ? String(req.query.status).trim() : "";
    const offset = (page - 1) * pageSize;
    const rows = listPixOrders({
      limit: pageSize,
      offset,
      status: status || null,
    });
    const total = countPixOrders(status || null);
    const orders = rows.map((r) => {
      let checkout = {};
      try {
        checkout = JSON.parse(String(r.checkout_meta || "{}"));
      } catch {
        checkout = {};
      }
      return {
        externalId: r.external_id,
        mpTransactionId: r.mp_transaction_id,
        status: r.status,
        amountCents: r.amount_cents,
        payerName: r.payer_name,
        customerEmail: checkout.email || null,
        phone: checkout.phone || null,
        city: checkout.city || null,
        stateUf: checkout.stateUf || null,
        createdAt: r.created_at,
      };
    });
    res.json({ orders, page, pageSize, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar pedidos" });
  }
});

app.get("/api/admin/orders/:externalId", requireAdminPerm("orders.read"), async (req, res) => {
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "ID inválido" });
  const payload = await getOrderPayloadByExternalId(externalId);
  if (!payload) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(payload);
});

app.post("/api/admin/upload/product-image", requireAdminPerm("products.write"), uploadLimiter, (req, res) => {
  productImageMulter.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ error: "Ficheiro demasiado grande (máximo 5 MB)." });
      }
      return res.status(400).json({
        error: err.message || "Erro no upload.",
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Selecione um ficheiro de imagem." });
    }
    return res.json({
      ok: true,
      url: `/uploads/products/${req.file.filename}`,
    });
  });
});

app.get("/api/admin/products", requireAdminPerm("products.read"), (req, res) => {
  try {
    const rawPage = Number(req.query.page);
    const rawSize = Number(req.query.pageSize);
    const page =
      Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const pageSize = Math.min(
      200,
      Math.max(10, Number.isFinite(rawSize) ? Math.floor(rawSize) : 40)
    );
    const q = String(req.query.q || "").trim();
    const category_id =
      req.query.category_id != null && String(req.query.category_id).trim() !== ""
        ? req.query.category_id
        : null;
    const offset = (page - 1) * pageSize;
    const products = listProductsAllPaged({
      q,
      category_id,
      limit: pageSize,
      offset,
    });
    const total = countProductsAllFiltered({ q, category_id });
    res.json({ products, page, pageSize, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
});

function csvCell(v) {
  const s = String(v ?? "").replace(/\r\n/g, "\n");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

app.get("/api/admin/orders/export.csv", requireAdminPerm("orders.read"), (_req, res) => {
  try {
    maybeRunPixPendingExpiryJob();
    const rows = listPixOrders({ limit: 50000, offset: 0, status: null });
    const header = [
      "external_id",
      "mp_transaction_id",
      "status",
      "amount_cents",
      "payer_name",
      "payer_document",
      "email",
      "phone",
      "city",
      "state",
      "created_at",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      let checkout = {};
      try {
        checkout = JSON.parse(String(r.checkout_meta || "{}"));
      } catch {
        checkout = {};
      }
      lines.push(
        [
          csvCell(r.external_id),
          csvCell(r.mp_transaction_id),
          csvCell(r.status),
          csvCell(r.amount_cents),
          csvCell(r.payer_name),
          csvCell(r.payer_document),
          csvCell(checkout.email),
          csvCell(checkout.phone),
          csvCell(checkout.city),
          csvCell(checkout.stateUf),
          csvCell(r.created_at),
        ].join(",")
      );
    }
    const body = `\uFEFF${lines.join("\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="gimports-pedidos-pix.csv"'
    );
    res.send(body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao exportar" });
  }
});

app.post("/api/admin/products", requireAdminPerm("products.write"), (req, res) => {
  try {
    const row = createProduct(req.body);
    res.status(201).json({ product: row });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : "";
    if (msg.includes("UNIQUE") || msg.includes("constraint")) {
      return res.status(409).json({ error: "Slug já existe; use outro slug." });
    }
    if (e instanceof Error && e.message === "Nome obrigatório") {
      return res.status(400).json({ error: e.message });
    }
    console.error(e);
    res.status(500).json({ error: "Erro ao criar produto" });
  }
});

app.put("/api/admin/products/:id", requireAdminPerm("products.write"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const row = updateProduct(id, req.body);
    if (!row) return res.status(404).json({ error: "Não encontrado" });
    res.json({ product: row });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : "";
    if (msg.includes("UNIQUE") || msg.includes("constraint")) {
      return res.status(409).json({ error: "Slug já existe." });
    }
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar" });
  }
});

app.delete("/api/admin/products/:id", requireAdminPerm("products.write"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "ID inválido" });
  }
  const ok = deleteProduct(id);
  if (!ok) return res.status(404).json({ error: "Não encontrado" });
  res.json({ ok: true });
});

app.get("/api/admin/products/:id", requireAdminPerm("products.read"), (req, res) => {
  const id = Number(req.params.id);
  const row = getProductById(id);
  if (!row) return res.status(404).json({ error: "Não encontrado" });
  res.json({ product: row });
});

app.get("/api/admin/categories", requireAdminPerm("categories.read"), (_req, res) => {
  try {
    res.json({ categories: listCategoriesAll() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
});

app.post("/api/admin/categories", requireAdminPerm("categories.write"), (req, res) => {
  try {
    const row = createCategory(req.body);
    res.status(201).json({ category: row });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : "";
    if (msg.includes("UNIQUE") || msg.includes("constraint")) {
      return res.status(409).json({ error: "Slug de categoria já existe." });
    }
    if (e instanceof Error && e.message.includes("obrigatório")) {
      return res.status(400).json({ error: e.message });
    }
    console.error(e);
    res.status(500).json({ error: "Erro ao criar categoria" });
  }
});

app.put("/api/admin/categories/:id", requireAdminPerm("categories.write"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const row = updateCategory(id, req.body);
    if (!row) return res.status(404).json({ error: "Não encontrado" });
    res.json({ category: row });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : "";
    if (msg.includes("UNIQUE") || msg.includes("constraint")) {
      return res.status(409).json({ error: "Slug já existe." });
    }
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar categoria" });
  }
});

app.delete("/api/admin/categories/:id", requireAdminPerm("categories.write"), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const ok = deleteCategory(id);
    if (!ok) return res.status(404).json({ error: "Não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message.includes("em uso")) {
      return res.status(409).json({ error: e.message });
    }
    console.error(e);
    res.status(500).json({ error: "Erro ao apagar categoria" });
  }
});

app.get("/api/admin/categories/:id", requireAdminPerm("categories.read"), (req, res) => {
  const id = Number(req.params.id);
  const row = getCategoryById(id);
  if (!row) return res.status(404).json({ error: "Não encontrado" });
  res.json({ category: row });
});

app.get(["/admin", "/admin/"], (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});
app.get(["/login", "/login/"], (_req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});
app.get(["/minha-conta", "/minha-conta/"], (_req, res) => {
  res.sendFile(path.join(publicDir, "minha-conta.html"));
});
app.get("/produto/:slug", (req, res) => {
  res.sendFile(path.join(publicDir, "produto.html"));
});
app.get(["/checkout", "/checkout/"], (_req, res) => {
  res.sendFile(path.join(publicDir, "checkout.html"));
});
app.use(express.static(publicDir));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (isProd) {
    return res.status(500).json({ error: "Erro interno" });
  }
  const msg = err instanceof Error ? err.message : "Erro interno";
  return res.status(500).json({ error: msg });
});

const BIND_HOST = "0.0.0.0";
const PUBLIC_IP = "45.157.16.196";

const server = app.listen(PORT, BIND_HOST, () => {
  console.log(`Loja local: http://127.0.0.1:${PORT}/`);
  console.log(`Admin local: http://127.0.0.1:${PORT}/admin`);
  console.log(`Loja pública: http://${PUBLIC_IP}:${PORT}/`);
  console.log(`Admin público: http://${PUBLIC_IP}:${PORT}/admin`);
  runPixPendingExpiryJob();
  runSupportChatsIdleCloseJob();
  void runLogisticsSyncJob();
  setInterval(runPixPendingExpiryJob, 60 * 1000);
  setInterval(runSupportChatsIdleCloseJob, 60 * 1000);
  setInterval(() => {
    void runLogisticsSyncJob();
  }, 2 * 60 * 1000);
});
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `Porta ${PORT} já está em uso. Liberte-a ou use outra, por exemplo: set PORT=3001 && npm start`
    );
    // Adiar exit evita assertion do libuv no Windows ao fechar o socket a meio do arranque.
    setImmediate(() => process.exit(1));
    return;
  }
  throw err;
});
