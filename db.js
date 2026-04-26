import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "data", "app.db");

/** @type {import("sql.js").Database | null} */
let db = null;

function ensureDir() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function persist() {
  if (!db) return;
  ensureDir();
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export function getSiteSetting(key, defaultVal = "") {
  if (!db) return defaultVal;
  const k = String(key || "").trim();
  if (!k) return defaultVal;
  const row = runGet(`SELECT value FROM site_settings WHERE key = ?`, [k]);
  if (!row || row.value == null || String(row.value) === "") return defaultVal;
  return String(row.value);
}

export function setSiteSetting(key, val) {
  if (!db) return;
  const k = String(key || "").trim();
  if (!k) return;
  const v = String(val ?? "");
  const existing = runGet(`SELECT key FROM site_settings WHERE key = ?`, [k]);
  if (existing) {
    runExec(`UPDATE site_settings SET value = ? WHERE key = ?`, [v, k]);
  } else {
    runExec(`INSERT INTO site_settings (key, value) VALUES (?, ?)`, [k, v]);
  }
  persist();
}

export function deleteSiteSetting(key) {
  if (!db) return;
  const k = String(key || "").trim();
  if (!k) return;
  runExec(`DELETE FROM site_settings WHERE key = ?`, [k]);
  if (db.getRowsModified() > 0) persist();
}

function runExec(sql, params = []) {
  db.run(sql, params);
}

function runGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function runAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export async function openDb() {
  if (db) return db;
  ensureDir();
  const sqlWasmPath = path.join(
    __dirname,
    "node_modules",
    "sql.js",
    "dist",
    "sql-wasm.wasm"
  );
  const SQL = await initSqlJs({
    // Explicit path avoids wasm resolution failures in hosted preview containers.
    locateFile: (file) => {
      if (file === "sql-wasm.wasm" && fs.existsSync(sqlWasmPath)) {
        return sqlWasmPath;
      }
      return file;
    },
  });
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  initSchema();
  migrateProductsCategoryColumn();
  migrateProductsOfferColumns();
  migratePixOrdersTable();
  migratePixOrdersCheckoutMeta();
  migratePixOrdersCustomerEmail();
  migrateUsersPermissionsColumn();
  migrateProductsInventoryColumns();
  migrateSuppliersAndStockTables();
  migrateSupportChatsColumns();
  return db;
}

function tableColumnNames(table) {
  return runAll(`PRAGMA table_info(${table})`, []).map((r) => r.name);
}

function migrateProductsCategoryColumn() {
  const cols = tableColumnNames("products");
  if (!cols.includes("category_id")) {
    runExec(
      "ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)"
    );
    const def = runGet(
      "SELECT id FROM categories WHERE slug = 'geral' LIMIT 1",
      []
    );
    if (def) {
      runExec("UPDATE products SET category_id = ? WHERE category_id IS NULL", [
        def.id,
      ]);
    }
    persist();
  }
  runExec("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)");
}

function migrateProductsOfferColumns() {
  const cols = tableColumnNames("products");
  let changed = false;
  if (!cols.includes("on_offer")) {
    runExec("ALTER TABLE products ADD COLUMN on_offer INTEGER NOT NULL DEFAULT 0");
    changed = true;
  }
  if (!cols.includes("compare_price_cents")) {
    runExec(
      "ALTER TABLE products ADD COLUMN compare_price_cents INTEGER NOT NULL DEFAULT 0"
    );
    changed = true;
  }
  if (changed) persist();
}

function migratePixOrdersTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pix_orders (
      external_id TEXT PRIMARY KEY,
      mp_transaction_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      amount_cents INTEGER NOT NULL,
      payer_name TEXT NOT NULL,
      payer_document TEXT NOT NULL,
      lines_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pix_orders_mp ON pix_orders(mp_transaction_id);
    CREATE INDEX IF NOT EXISTS idx_pix_orders_status ON pix_orders(status);
  `);
  persist();
}

function migratePixOrdersCheckoutMeta() {
  const cols = tableColumnNames("pix_orders");
  if (cols.includes("checkout_meta")) return;
  try {
    runExec(
      "ALTER TABLE pix_orders ADD COLUMN checkout_meta TEXT NOT NULL DEFAULT '{}'"
    );
    persist();
  } catch (e) {
    console.error("migratePixOrdersCheckoutMeta:", e);
  }
}

function migratePixOrdersCustomerEmail() {
  const cols = tableColumnNames("pix_orders");
  if (cols.includes("customer_email")) return;
  try {
    runExec(
      "ALTER TABLE pix_orders ADD COLUMN customer_email TEXT NOT NULL DEFAULT ''"
    );
    const rows = runAll("SELECT external_id, checkout_meta FROM pix_orders", []);
    for (const r of rows) {
      let email = "";
      try {
        const m = JSON.parse(String(r.checkout_meta || "{}"));
        email = String(m.email || "").trim().toLowerCase();
      } catch {
        email = "";
      }
      runExec(
        "UPDATE pix_orders SET customer_email = ? WHERE external_id = ?",
        [email, r.external_id]
      );
    }
    persist();
  } catch (e) {
    console.error("migratePixOrdersCustomerEmail:", e);
  }
}

function migrateProductsInventoryColumns() {
  const cols = tableColumnNames("products");
  let changed = false;
  if (!cols.includes("inventory_mode")) {
    runExec(
      "ALTER TABLE products ADD COLUMN inventory_mode TEXT NOT NULL DEFAULT 'local'"
    );
    changed = true;
  }
  if (!cols.includes("low_stock_threshold")) {
    runExec(
      "ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5"
    );
    changed = true;
  }
  if (!cols.includes("allow_backorder")) {
    runExec(
      "ALTER TABLE products ADD COLUMN allow_backorder INTEGER NOT NULL DEFAULT 0"
    );
    changed = true;
  }
  if (changed) persist();
}

function migrateSuppliersAndStockTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      lead_time_days INTEGER NOT NULL DEFAULT 7,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(active);

    CREATE TABLE IF NOT EXISTS product_supplier_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      supplier_sku TEXT NOT NULL DEFAULT '',
      supplier_cost_cents INTEGER NOT NULL DEFAULT 0,
      supplier_eta_days INTEGER NOT NULL DEFAULT 7,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_psl_product ON product_supplier_links(product_id);
    CREATE INDEX IF NOT EXISTS idx_psl_supplier ON product_supplier_links(supplier_id);

    CREATE TABLE IF NOT EXISTS stock_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      movement_type TEXT NOT NULL,
      qty_delta INTEGER NOT NULL,
      qty_after INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      reference_type TEXT NOT NULL DEFAULT '',
      reference_id TEXT NOT NULL DEFAULT '',
      actor_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

    CREATE TABLE IF NOT EXISTS supplier_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_order_id TEXT NOT NULL REFERENCES pix_orders(external_id) ON DELETE CASCADE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      status TEXT NOT NULL DEFAULT 'AGUARDANDO_FORNECEDOR',
      total_cost_cents INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      tracking_code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_supplier_orders_external ON supplier_orders(external_order_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(status);

    CREATE TABLE IF NOT EXISTS order_logistics (
      external_order_id TEXT PRIMARY KEY NOT NULL REFERENCES pix_orders(external_id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT '',
      freight_quote_cents INTEGER NOT NULL DEFAULT 0,
      shipment_id TEXT NOT NULL DEFAULT '',
      tracking_code TEXT NOT NULL DEFAULT '',
      delivery_status TEXT NOT NULL DEFAULT '',
      last_sync_at TEXT,
      raw_payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_order_id TEXT NOT NULL REFERENCES pix_orders(external_id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_order_timeline_external ON order_timeline_events(external_order_id);
    CREATE INDEX IF NOT EXISTS idx_order_timeline_created ON order_timeline_events(created_at);

    CREATE TABLE IF NOT EXISTS visit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      path TEXT NOT NULL,
      referrer TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      device_type TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_visit_events_created ON visit_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_visit_events_session ON visit_events(session_id);

    CREATE TABLE IF NOT EXISTS online_sessions (
      session_id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL DEFAULT '/',
      ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_online_last_seen ON online_sessions(last_seen_at);

    CREATE TABLE IF NOT EXISTS support_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_email TEXT NOT NULL DEFAULT '',
      customer_session_id TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      reason_category TEXT NOT NULL DEFAULT '',
      reason_detail TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'OPEN',
      assigned_admin_id INTEGER,
      last_customer_message_at TEXT,
      last_admin_message_at TEXT,
      admin_last_read_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_support_chats_status ON support_chats(status);
    CREATE INDEX IF NOT EXISTS idx_support_chats_customer ON support_chats(customer_email);

    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL,
      sender_email TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_support_messages_chat ON support_messages(chat_id);
  `);
  persist();
}

function migrateSupportChatsColumns() {
  const cols = tableColumnNames("support_chats");
  let changed = false;
  const addCol = (name, sql) => {
    if (cols.includes(name)) return;
    runExec(`ALTER TABLE support_chats ADD COLUMN ${sql}`);
    changed = true;
  };
  addCol("reason_category", "reason_category TEXT NOT NULL DEFAULT ''");
  addCol("reason_detail", "reason_detail TEXT NOT NULL DEFAULT ''");
  addCol("last_customer_message_at", "last_customer_message_at TEXT");
  addCol("last_admin_message_at", "last_admin_message_at TEXT");
  addCol("admin_last_read_at", "admin_last_read_at TEXT");
  addCol("closed_at", "closed_at TEXT");
  if (changed) persist();
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL DEFAULT 0,
      on_offer INTEGER NOT NULL DEFAULT 0,
      compare_price_cents INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      category_id INTEGER REFERENCES categories(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  const urow = runGet("SELECT COUNT(*) AS c FROM users", []);
  if (!urow || Number(urow.c) === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    runExec(
      "INSERT INTO users (email, password_hash, role, permissions_json) VALUES (?, ?, 'admin', ?)",
      ["admin@local.test", hash, '["*"]']
    );
    persist();
  }

  const crow = runGet("SELECT COUNT(*) AS c FROM categories", []);
  if (!crow || Number(crow.c) === 0) {
    const seeds = [
      ["Geral", "geral", 0],
      ["Peptídeo", "peptideo", 10],
      ["Medicamento", "medicamento", 20],
    ];
    for (const [name, slug, sort] of seeds) {
      runExec(
        "INSERT INTO categories (name, slug, sort_order, active) VALUES (?, ?, ?, 1)",
        [name, slug, sort]
      );
    }
    persist();
  }

  const pc = runGet("SELECT COUNT(*) AS c FROM products", []);
  if (!pc || Number(pc.c) === 0) {
    const cat = runGet("SELECT id FROM categories WHERE slug = 'geral' LIMIT 1", []);
    const cid = cat ? cat.id : null;
    const samples = [
      [
        "item-demo-1",
        "Item demonstração 1",
        "Descrição de exemplo. Substitua pelos seus produtos reais no painel admin.",
        19900,
        "/assets/no-image.svg",
        10,
        1,
        cid,
      ],
      [
        "item-demo-2",
        "Item demonstração 2",
        "Outro item de exemplo para testar listagem.",
        4590,
        "/assets/no-image.svg",
        25,
        1,
        cid,
      ],
    ];
    for (const s of samples) {
      runExec(
        `INSERT INTO products (slug, name, description, price_cents, image_url, stock, active, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        s
      );
    }
    persist();
  }
}

function migrateUsersPermissionsColumn() {
  const cols = tableColumnNames("users");
  if (cols.includes("permissions_json")) return;
  runExec(
    "ALTER TABLE users ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '[]'"
  );
  runExec(
    "UPDATE users SET permissions_json = '[\"*\"]' WHERE role = 'admin'"
  );
  persist();
}

function lastInsertRowid() {
  const r = runGet("SELECT last_insert_rowid() AS id", []);
  return r ? Number(r.id) : null;
}

export function findUserByEmail(email) {
  return runGet("SELECT * FROM users WHERE lower(email) = lower(?)", [email]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cria utilizador com role `customer`. Palavra-passe só em texto no pedido HTTP; guarda-se hash na BD.
 * @throws {Error} validação ou email duplicado
 */
export function createUserCustomer({ email, password }) {
  const em = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(em)) throw new Error("Email inválido");
  const pw = String(password || "");
  if (pw.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  if (pw.length > 200) throw new Error("Senha demasiado longa");
  if (findUserByEmail(em)) throw new Error("Este email já está registado");
  const hash = bcrypt.hashSync(pw, 10);
  runExec(
    "INSERT INTO users (email, password_hash, role, permissions_json) VALUES (?, ?, 'customer', '[]')",
    [em, hash]
  );
  const id = lastInsertRowid();
  persist();
  return { id, email: em, role: "customer" };
}

export function listAdminUsers() {
  return runAll(
    `SELECT id, email, role, permissions_json, created_at
     FROM users
     WHERE role = 'admin'
     ORDER BY id ASC`,
    []
  );
}

export function createAdminUser({ email, password, permissions = [] }) {
  const em = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(em)) throw new Error("Email inválido");
  const pw = String(password || "");
  if (pw.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  if (findUserByEmail(em)) throw new Error("Este email já está registado");
  const hash = bcrypt.hashSync(pw, 10);
  const perms = Array.isArray(permissions) ? permissions : [];
  const dedup = [...new Set(perms.map((p) => String(p || "").trim()).filter(Boolean))];
  runExec(
    "INSERT INTO users (email, password_hash, role, permissions_json) VALUES (?, ?, 'admin', ?)",
    [em, hash, JSON.stringify(dedup.length ? dedup : ["*"])]
  );
  const id = lastInsertRowid();
  persist();
  return runGet(
    `SELECT id, email, role, permissions_json, created_at FROM users WHERE id = ?`,
    [id]
  );
}

export function updateAdminUser(id, body = {}) {
  const uid = Math.floor(Number(id));
  if (!Number.isInteger(uid) || uid < 1) return null;
  const cur = runGet(`SELECT * FROM users WHERE id = ? AND role = 'admin'`, [uid]);
  if (!cur) return null;
  const email = body.email != null ? String(body.email).trim().toLowerCase() : cur.email;
  if (!EMAIL_RE.test(email)) throw new Error("Email inválido");
  const password = body.password != null ? String(body.password) : "";
  const nextHash = password ? bcrypt.hashSync(password, 10) : cur.password_hash;
  const perms = Array.isArray(body.permissions)
    ? [...new Set(body.permissions.map((p) => String(p || "").trim()).filter(Boolean))]
    : JSON.parse(String(cur.permissions_json || "[]"));
  runExec(
    `UPDATE users
     SET email = ?, password_hash = ?, permissions_json = ?
     WHERE id = ? AND role = 'admin'`,
    [email, nextHash, JSON.stringify(perms.length ? perms : ["*"]), uid]
  );
  persist();
  return runGet(
    `SELECT id, email, role, permissions_json, created_at FROM users WHERE id = ?`,
    [uid]
  );
}

export function listCategoriesActive() {
  return runAll(
    `SELECT id, name, slug, sort_order FROM categories WHERE active = 1 ORDER BY sort_order ASC, name ASC`,
    []
  );
}

export function listCategoriesAll() {
  return runAll(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
     FROM categories c ORDER BY c.sort_order ASC, c.name ASC`,
    []
  );
}

export function getCategoryById(id) {
  return runGet("SELECT * FROM categories WHERE id = ?", [id]);
}

function catSlugify(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "categoria";
}

export function createCategory(body) {
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Nome da categoria obrigatório");
  const slug = body.slug?.trim() || catSlugify(name);
  const sort_order = Math.floor(Number(body.sort_order) || 0);
  const active = body.active === false || body.active === 0 ? 0 : 1;
  runExec(
    "INSERT INTO categories (name, slug, sort_order, active) VALUES (?, ?, ?, ?)",
    [name, slug, sort_order, active]
  );
  const id = lastInsertRowid();
  persist();
  return getCategoryById(id);
}

export function updateCategory(id, body) {
  const ex = getCategoryById(id);
  if (!ex) return null;
  const name = body.name != null ? String(body.name).trim() : ex.name;
  const slug =
    body.slug != null ? String(body.slug).trim() || catSlugify(name) : ex.slug;
  const sort_order =
    body.sort_order != null ? Math.floor(Number(body.sort_order)) : ex.sort_order;
  const active =
    body.active != null ? (body.active ? 1 : 0) : ex.active;
  runExec(
    "UPDATE categories SET name=?, slug=?, sort_order=?, active=? WHERE id=?",
    [name, slug, sort_order, active, id]
  );
  persist();
  return getCategoryById(id);
}

export function deleteCategory(id) {
  const n = runGet(
    "SELECT COUNT(*) AS c FROM products WHERE category_id = ?",
    [id]
  );
  if (n && Number(n.c) > 0) {
    throw new Error("Categoria em uso por produtos");
  }
  runExec("DELETE FROM categories WHERE id = ?", [id]);
  const ch = db.getRowsModified();
  if (ch > 0) persist();
  return ch > 0;
}

export function listProductsActive() {
  return runAll(
    `SELECT p.id, p.slug, p.name, p.description, p.price_cents, p.on_offer, p.compare_price_cents,
            p.image_url, p.stock, p.category_id, p.inventory_mode, p.low_stock_threshold, p.allow_backorder,
            c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.active = 1 ORDER BY p.id DESC`,
    []
  );
}

export function listProductsAll() {
  return runAll(
    `SELECT p.id, p.slug, p.name, p.description, p.price_cents, p.on_offer, p.compare_price_cents,
            p.image_url, p.stock, p.active, p.inventory_mode, p.low_stock_threshold, p.allow_backorder,
            p.category_id, p.created_at, p.updated_at,
            c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.id DESC`,
    []
  );
}

/** Pesquisa + categoria + paginação (painel admin, média escala). */
export function listProductsAllPaged({
  q = "",
  category_id = null,
  limit = 40,
  offset = 0,
} = {}) {
  const lim = Math.min(200, Math.max(1, Math.floor(Number(limit) || 40)));
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  const search = String(q || "").trim();
  const cidRaw = category_id != null && category_id !== "" ? Math.floor(Number(category_id)) : null;
  const cid = Number.isInteger(cidRaw) && cidRaw > 0 ? cidRaw : null;

  let sql = `SELECT p.id, p.slug, p.name, p.description, p.price_cents, p.on_offer, p.compare_price_cents,
            p.image_url, p.stock, p.active, p.inventory_mode, p.low_stock_threshold, p.allow_backorder,
            p.category_id, p.created_at, p.updated_at,
            c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE 1=1`;
  const params = [];
  if (search) {
    const esc = search.replace(/%/g, "").replace(/_/g, " ");
    const like = `%${esc}%`;
    sql += ` AND (
      p.name LIKE ? COLLATE NOCASE OR p.slug LIKE ? COLLATE NOCASE
      OR IFNULL(p.description,'') LIKE ? COLLATE NOCASE
    )`;
    params.push(like, like, like);
  }
  if (cid != null) {
    sql += ` AND p.category_id = ?`;
    params.push(cid);
  }
  sql += ` ORDER BY p.id DESC LIMIT ? OFFSET ?`;
  params.push(lim, off);
  return runAll(sql, params);
}

export function countProductsAllFiltered({ q = "", category_id = null } = {}) {
  const search = String(q || "").trim();
  const cidRaw = category_id != null && category_id !== "" ? Math.floor(Number(category_id)) : null;
  const cid = Number.isInteger(cidRaw) && cidRaw > 0 ? cidRaw : null;

  let sql = `SELECT COUNT(*) AS c FROM products p WHERE 1=1`;
  const params = [];
  if (search) {
    const esc = search.replace(/%/g, "").replace(/_/g, " ");
    const like = `%${esc}%`;
    sql += ` AND (
      p.name LIKE ? COLLATE NOCASE OR p.slug LIKE ? COLLATE NOCASE
      OR IFNULL(p.description,'') LIKE ? COLLATE NOCASE
    )`;
    params.push(like, like, like);
  }
  if (cid != null) {
    sql += ` AND p.category_id = ?`;
    params.push(cid);
  }
  const r = runGet(sql, params);
  return r ? Number(r.c) : 0;
}

export function getProductById(id) {
  return runGet(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id]
  );
}

export function getProductBySlug(slug) {
  return runGet(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ? AND p.active = 1`,
    [slug]
  );
}

function slugify(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

function resolveCategoryId(body, existing) {
  if (body.category_id != null && body.category_id !== "") {
    const id = Math.floor(Number(body.category_id));
    if (Number.isInteger(id) && id > 0) {
      const c = getCategoryById(id);
      if (c) return id;
    }
  }
  if (existing && existing.category_id) return existing.category_id;
  const g = runGet("SELECT id FROM categories WHERE slug = 'geral' LIMIT 1", []);
  return g ? g.id : null;
}

export function createProduct(body) {
  const slug = body.slug?.trim() || slugify(body.name);
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Nome obrigatório");
  const description = String(body.description ?? "");
  const price_cents = Math.max(0, Math.round(Number(body.price_cents) || 0));
  const on_offer = body.on_offer === true || body.on_offer === 1 ? 1 : 0;
  const compare_price_cents = Math.max(
    0,
    Math.round(Number(body.compare_price_cents) || 0)
  );
  const image_url = String(body.image_url ?? "");
  const stock = Math.max(0, Math.floor(Number(body.stock) || 0));
  const active = body.active === false || body.active === 0 ? 0 : 1;
  const inventory_mode = String(body.inventory_mode || "local").trim().toLowerCase();
  const inventoryModeNorm =
    inventory_mode === "dropshipping" || inventory_mode === "hybrid"
      ? inventory_mode
      : "local";
  const low_stock_threshold = Math.max(
    0,
    Math.floor(Number(body.low_stock_threshold) || 5)
  );
  const allow_backorder =
    body.allow_backorder === true || body.allow_backorder === 1 ? 1 : 0;
  const category_id = resolveCategoryId(body, null);
  runExec(
    `INSERT INTO products (slug, name, description, price_cents, on_offer, compare_price_cents, image_url, stock, active, category_id, inventory_mode, low_stock_threshold, allow_backorder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      name,
      description,
      price_cents,
      on_offer,
      compare_price_cents,
      image_url,
      stock,
      active,
      category_id,
      inventoryModeNorm,
      low_stock_threshold,
      allow_backorder,
    ]
  );
  const id = lastInsertRowid();
  persist();
  return getProductById(id);
}

export function updateProduct(id, body) {
  const existing = getProductById(id);
  if (!existing) return null;
  const name = body.name != null ? String(body.name).trim() : existing.name;
  const slug =
    body.slug != null
      ? String(body.slug).trim() || slugify(name)
      : existing.slug;
  const description =
    body.description != null ? String(body.description) : existing.description;
  const price_cents =
    body.price_cents != null
      ? Math.max(0, Math.round(Number(body.price_cents)))
      : existing.price_cents;
  const on_offer =
    body.on_offer != null ? (body.on_offer ? 1 : 0) : existing.on_offer;
  const compare_price_cents =
    body.compare_price_cents != null
      ? Math.max(0, Math.round(Number(body.compare_price_cents)))
      : existing.compare_price_cents;
  const image_url =
    body.image_url != null ? String(body.image_url) : existing.image_url;
  const stock =
    body.stock != null
      ? Math.max(0, Math.floor(Number(body.stock)))
      : existing.stock;
  const active =
    body.active != null ? (body.active ? 1 : 0) : existing.active;
  const inventory_mode =
    body.inventory_mode != null
      ? String(body.inventory_mode).trim().toLowerCase()
      : String(existing.inventory_mode || "local").toLowerCase();
  const inventoryModeNorm =
    inventory_mode === "dropshipping" || inventory_mode === "hybrid"
      ? inventory_mode
      : "local";
  const low_stock_threshold =
    body.low_stock_threshold != null
      ? Math.max(0, Math.floor(Number(body.low_stock_threshold)))
      : Math.max(0, Math.floor(Number(existing.low_stock_threshold) || 5));
  const allow_backorder =
    body.allow_backorder != null
      ? body.allow_backorder
        ? 1
        : 0
      : existing.allow_backorder;
  const category_id = resolveCategoryId(body, existing);
  runExec(
    `UPDATE products SET slug=?, name=?, description=?, price_cents=?, on_offer=?, compare_price_cents=?, image_url=?, stock=?, active=?,
      category_id=?, inventory_mode=?, low_stock_threshold=?, allow_backorder=?, updated_at=datetime('now') WHERE id=?`,
    [
      slug,
      name,
      description,
      price_cents,
      on_offer,
      compare_price_cents,
      image_url,
      stock,
      active,
      category_id,
      inventoryModeNorm,
      low_stock_threshold,
      allow_backorder,
      id,
    ]
  );
  persist();
  return getProductById(id);
}

export function deleteProduct(id) {
  runExec("DELETE FROM products WHERE id = ?", [id]);
  const changes = db.getRowsModified();
  if (changes > 0) persist();
  return changes > 0;
}

/**
 * @param {object} row
 * @param {string} row.external_id
 * @param {string} row.mp_transaction_id
 * @param {number} row.amount_cents
 * @param {string} row.payer_name
 * @param {string} row.payer_document
 * @param {string} row.lines_json
 * @param {string} [row.checkout_meta] JSON com email, morada, frete, etc.
 */
export function insertPixOrder(row) {
  const meta = row.checkout_meta != null ? String(row.checkout_meta) : "{}";
  let customerEmail = "";
  try {
    customerEmail = String(JSON.parse(meta).email || "").trim().toLowerCase();
  } catch {
    customerEmail = "";
  }
  runExec(
    `INSERT INTO pix_orders (external_id, mp_transaction_id, status, amount_cents, payer_name, payer_document, lines_json, checkout_meta, customer_email)
     VALUES (?, ?, 'PENDENTE', ?, ?, ?, ?, ?, ?)`,
    [
      row.external_id,
      row.mp_transaction_id,
      row.amount_cents,
      row.payer_name,
      row.payer_document,
      row.lines_json,
      meta,
      customerEmail,
    ]
  );
  persist();
}

/** Pedidos PIX em que o e-mail do checkout coincide com o cliente logado */
export function listPixOrdersByCustomerEmail(email) {
  const em = String(email || "").trim().toLowerCase();
  if (!em) return [];
  return runAll(
    `SELECT * FROM pix_orders WHERE customer_email = ? ORDER BY datetime(created_at) DESC`,
    [em]
  );
}

export function getPixOrderByExternalId(externalId) {
  return runGet("SELECT * FROM pix_orders WHERE external_id = ?", [externalId]);
}

export function getPixOrderByMpId(mpId) {
  return runGet("SELECT * FROM pix_orders WHERE mp_transaction_id = ?", [
    String(mpId),
  ]);
}

export function updatePixOrderStatus(externalId, status) {
  runExec(
    `UPDATE pix_orders SET status = ?, updated_at = datetime('now') WHERE external_id = ?`,
    [String(status), externalId]
  );
  if (db.getRowsModified() > 0) persist();
}

/**
 * Pedidos PIX ainda PENDENTE há mais de `maxAgeMinutes` → CANCELADO (pagamento não concluído).
 * @returns número de linhas atualizadas
 */
export function cancelStalePendingPixOrders(maxAgeMinutes = 40) {
  const m = Math.max(1, Math.floor(Number(maxAgeMinutes) || 40));
  const sec = m * 60;
  runExec(
    `UPDATE pix_orders SET status = 'CANCELADO', updated_at = datetime('now')
     WHERE status = 'PENDENTE'
       AND (strftime('%s','now') - strftime('%s', datetime(created_at))) > ?`,
    [sec]
  );
  const n = db.getRowsModified();
  if (n > 0) persist();
  return n;
}

export function updatePixOrderCheckoutMeta(externalId, checkoutMeta) {
  runExec(
    `UPDATE pix_orders SET checkout_meta = ?, updated_at = datetime('now') WHERE external_id = ?`,
    [String(checkoutMeta ?? "{}"), String(externalId)]
  );
  if (db.getRowsModified() > 0) persist();
}

/** Lista pedidos PIX (mais recentes primeiro). */
export function listPixOrders({ limit = 25, offset = 0, status = null } = {}) {
  const lim = Math.min(200, Math.max(1, Math.floor(Number(limit) || 25)));
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  const st = status != null ? String(status).trim() : "";
  if (st) {
    return runAll(
      `SELECT * FROM pix_orders WHERE status = ? ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
      [st, lim, off]
    );
  }
  return runAll(
    `SELECT * FROM pix_orders ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
    [lim, off]
  );
}

export function countPixOrders(status = null) {
  const st = status != null ? String(status).trim() : "";
  if (st) {
    const r = runGet(`SELECT COUNT(*) AS c FROM pix_orders WHERE status = ?`, [st]);
    return r ? Number(r.c) : 0;
  }
  const r = runGet(`SELECT COUNT(*) AS c FROM pix_orders`, []);
  return r ? Number(r.c) : 0;
}

export function pixOrdersStatusCounts() {
  return runAll(
    `SELECT status AS status, COUNT(*) AS n FROM pix_orders GROUP BY status ORDER BY status`,
    []
  );
}

/** Totais para o painel admin (catálogo + receita PIX concluída). */
export function adminCatalogCounts() {
  const pa = runGet(`SELECT COUNT(*) AS c FROM products WHERE active = 1`, []);
  const pt = runGet(`SELECT COUNT(*) AS c FROM products`, []);
  const ca = runGet(`SELECT COUNT(*) AS c FROM categories WHERE active = 1`, []);
  const ct = runGet(`SELECT COUNT(*) AS c FROM categories`, []);
  const rev = runGet(
    `SELECT IFNULL(SUM(amount_cents), 0) AS s FROM pix_orders WHERE status = 'COMPLETO'`,
    []
  );
  const pend = runGet(
    `SELECT COUNT(*) AS c FROM pix_orders WHERE status = 'PENDENTE'`,
    []
  );
  return {
    productsActive: Number(pa?.c || 0),
    productsTotal: Number(pt?.c || 0),
    categoriesActive: Number(ca?.c || 0),
    categoriesTotal: Number(ct?.c || 0),
    revenueCompleteCents: Number(rev?.s || 0),
    ordersPending: Number(pend?.c || 0),
  };
}

export function getStockSetting(key, defaultVal = "") {
  const row = runGet(`SELECT value FROM stock_settings WHERE key = ?`, [
    String(key || ""),
  ]);
  if (!row || row.value == null || String(row.value) === "") return defaultVal;
  return String(row.value);
}

export function setStockSetting(key, value) {
  const k = String(key || "").trim();
  if (!k) return;
  const v = String(value ?? "");
  const row = runGet(`SELECT key FROM stock_settings WHERE key = ?`, [k]);
  if (row) runExec(`UPDATE stock_settings SET value = ? WHERE key = ?`, [v, k]);
  else runExec(`INSERT INTO stock_settings (key, value) VALUES (?, ?)`, [k, v]);
  persist();
}

export function listSuppliers() {
  return runAll(`SELECT * FROM suppliers ORDER BY active DESC, name ASC`, []);
}

export function getSupplierById(id) {
  return runGet(`SELECT * FROM suppliers WHERE id = ?`, [id]);
}

export function createSupplier(body) {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Nome do fornecedor obrigatório.");
  const contact_name = String(body?.contact_name || "").trim();
  const contact_email = String(body?.contact_email || "").trim();
  const contact_phone = String(body?.contact_phone || "").trim();
  const lead_time_days = Math.max(
    1,
    Math.floor(Number(body?.lead_time_days) || 7)
  );
  const active = body?.active === false || body?.active === 0 ? 0 : 1;
  runExec(
    `INSERT INTO suppliers (name, contact_name, contact_email, contact_phone, lead_time_days, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, contact_name, contact_email, contact_phone, lead_time_days, active]
  );
  const id = lastInsertRowid();
  persist();
  return getSupplierById(id);
}

export function updateSupplier(id, body) {
  const cur = getSupplierById(id);
  if (!cur) return null;
  const name = body?.name != null ? String(body.name).trim() : cur.name;
  const contact_name =
    body?.contact_name != null ? String(body.contact_name).trim() : cur.contact_name;
  const contact_email =
    body?.contact_email != null
      ? String(body.contact_email).trim()
      : cur.contact_email;
  const contact_phone =
    body?.contact_phone != null
      ? String(body.contact_phone).trim()
      : cur.contact_phone;
  const lead_time_days =
    body?.lead_time_days != null
      ? Math.max(1, Math.floor(Number(body.lead_time_days) || 7))
      : Math.max(1, Math.floor(Number(cur.lead_time_days) || 7));
  const active = body?.active != null ? (body.active ? 1 : 0) : cur.active;
  runExec(
    `UPDATE suppliers SET name=?, contact_name=?, contact_email=?, contact_phone=?, lead_time_days=?, active=?, updated_at=datetime('now') WHERE id=?`,
    [name, contact_name, contact_email, contact_phone, lead_time_days, active, id]
  );
  persist();
  return getSupplierById(id);
}

export function upsertProductSupplierLink(productId, body) {
  const pid = Math.floor(Number(productId));
  if (!Number.isInteger(pid) || pid < 1) throw new Error("Produto inválido");
  const supplier_id = Math.floor(Number(body?.supplier_id));
  if (!Number.isInteger(supplier_id) || supplier_id < 1)
    throw new Error("Fornecedor inválido");
  const supplier_sku = String(body?.supplier_sku || "").trim();
  const supplier_cost_cents = Math.max(
    0,
    Math.floor(Number(body?.supplier_cost_cents) || 0)
  );
  const supplier_eta_days = Math.max(
    1,
    Math.floor(Number(body?.supplier_eta_days) || 7)
  );
  const is_primary = body?.is_primary ? 1 : 0;
  const row = runGet(
    `SELECT id FROM product_supplier_links WHERE product_id = ? AND supplier_id = ?`,
    [pid, supplier_id]
  );
  if (is_primary) {
    runExec(
      `UPDATE product_supplier_links SET is_primary = 0 WHERE product_id = ?`,
      [pid]
    );
  }
  if (row) {
    runExec(
      `UPDATE product_supplier_links
       SET supplier_sku=?, supplier_cost_cents=?, supplier_eta_days=?, is_primary=?, updated_at=datetime('now')
       WHERE id=?`,
      [supplier_sku, supplier_cost_cents, supplier_eta_days, is_primary, row.id]
    );
  } else {
    runExec(
      `INSERT INTO product_supplier_links (product_id, supplier_id, supplier_sku, supplier_cost_cents, supplier_eta_days, is_primary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [pid, supplier_id, supplier_sku, supplier_cost_cents, supplier_eta_days, is_primary]
    );
  }
  persist();
  return runAll(
    `SELECT l.*, s.name AS supplier_name
     FROM product_supplier_links l
     LEFT JOIN suppliers s ON s.id = l.supplier_id
     WHERE l.product_id = ?
     ORDER BY l.is_primary DESC, l.id ASC`,
    [pid]
  );
}

export function listProductSupplierLinks(productId) {
  const pid = Math.floor(Number(productId));
  if (!Number.isInteger(pid) || pid < 1) return [];
  return runAll(
    `SELECT l.*, s.name AS supplier_name
     FROM product_supplier_links l
     LEFT JOIN suppliers s ON s.id = l.supplier_id
     WHERE l.product_id = ?
     ORDER BY l.is_primary DESC, l.id ASC`,
    [pid]
  );
}

export function addStockMovement({
  productId,
  movementType,
  qtyDelta,
  reason = "",
  referenceType = "",
  referenceId = "",
  actorEmail = "",
}) {
  const pid = Math.floor(Number(productId));
  if (!Number.isInteger(pid) || pid < 1) throw new Error("Produto inválido.");
  const q = Math.floor(Number(qtyDelta));
  if (!Number.isInteger(q) || q === 0) throw new Error("Quantidade inválida.");
  if (Math.abs(q) > 1_000_000) throw new Error("Quantidade fora do limite permitido.");
  const p = getProductById(pid);
  if (!p) throw new Error("Produto não encontrado.");
  const after = Math.max(0, Math.floor(Number(p.stock) || 0) + q);
  runExec(
    `UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?`,
    [after, pid]
  );
  runExec(
    `INSERT INTO stock_movements (product_id, movement_type, qty_delta, qty_after, reason, reference_type, reference_id, actor_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pid,
      String(movementType || "AJUSTE"),
      q,
      after,
      String(reason || ""),
      String(referenceType || ""),
      String(referenceId || ""),
      String(actorEmail || ""),
    ]
  );
  persist();
  return {
    product: getProductById(pid),
    movement: runGet(`SELECT * FROM stock_movements WHERE id = last_insert_rowid()`, []),
  };
}

export function listStockMovements({ limit = 100, offset = 0, productId = null } = {}) {
  const lim = Math.min(500, Math.max(1, Math.floor(Number(limit) || 100)));
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  const pid = Math.floor(Number(productId));
  if (Number.isInteger(pid) && pid > 0) {
    return runAll(
      `SELECT m.*, p.name AS product_name, p.slug AS product_slug
       FROM stock_movements m
       LEFT JOIN products p ON p.id = m.product_id
       WHERE m.product_id = ?
       ORDER BY m.id DESC LIMIT ? OFFSET ?`,
      [pid, lim, off]
    );
  }
  return runAll(
    `SELECT m.*, p.name AS product_name, p.slug AS product_slug
     FROM stock_movements m
     LEFT JOIN products p ON p.id = m.product_id
     ORDER BY m.id DESC LIMIT ? OFFSET ?`,
    [lim, off]
  );
}

export function countLowStockProducts(defaultThreshold = 5) {
  const th = Math.max(0, Math.floor(Number(defaultThreshold) || 5));
  const row = runGet(
    `SELECT COUNT(*) AS c
     FROM products
     WHERE active = 1
       AND inventory_mode != 'dropshipping'
       AND stock <= CASE
         WHEN low_stock_threshold IS NULL OR low_stock_threshold < 0 THEN ?
         ELSE low_stock_threshold
       END`,
    [th]
  );
  return Number(row?.c || 0);
}

export function listLowStockProducts(defaultThreshold = 5) {
  const th = Math.max(0, Math.floor(Number(defaultThreshold) || 5));
  return runAll(
    `SELECT id, slug, name, stock, low_stock_threshold, inventory_mode
     FROM products
     WHERE active = 1
       AND inventory_mode != 'dropshipping'
       AND stock <= CASE
         WHEN low_stock_threshold IS NULL OR low_stock_threshold < 0 THEN ?
         ELSE low_stock_threshold
       END
     ORDER BY stock ASC, id DESC`,
    [th]
  );
}

export function createSupplierOrder({
  externalOrderId,
  supplierId,
  status = "AGUARDANDO_FORNECEDOR",
  totalCostCents = 0,
  payloadJson = "{}",
}) {
  runExec(
    `INSERT INTO supplier_orders (external_order_id, supplier_id, status, total_cost_cents, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(externalOrderId || ""),
      Math.floor(Number(supplierId) || 0),
      String(status || "AGUARDANDO_FORNECEDOR"),
      Math.max(0, Math.floor(Number(totalCostCents) || 0)),
      String(payloadJson || "{}"),
    ]
  );
  const id = lastInsertRowid();
  persist();
  return runGet(
    `SELECT so.*, s.name AS supplier_name FROM supplier_orders so
     LEFT JOIN suppliers s ON s.id = so.supplier_id
     WHERE so.id = ?`,
    [id]
  );
}

export function listSupplierOrdersByExternalOrder(externalOrderId) {
  return runAll(
    `SELECT so.*, s.name AS supplier_name FROM supplier_orders so
     LEFT JOIN suppliers s ON s.id = so.supplier_id
     WHERE so.external_order_id = ?
     ORDER BY so.id DESC`,
    [String(externalOrderId || "")]
  );
}

export function updateSupplierOrderStatus(id, status, trackingCode = "") {
  runExec(
    `UPDATE supplier_orders
     SET status = ?, tracking_code = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [String(status || ""), String(trackingCode || ""), Math.floor(Number(id) || 0)]
  );
  if (db.getRowsModified() > 0) persist();
}

export function getSupplierOrderById(id) {
  return runGet(`SELECT * FROM supplier_orders WHERE id = ?`, [
    Math.floor(Number(id) || 0),
  ]);
}

export function upsertOrderLogistics({
  externalOrderId,
  provider = "",
  freightQuoteCents = 0,
  shipmentId = "",
  trackingCode = "",
  deliveryStatus = "",
  rawPayload = "{}",
}) {
  const oid = String(externalOrderId || "").trim();
  if (!oid) return null;
  const row = runGet(
    `SELECT external_order_id FROM order_logistics WHERE external_order_id = ?`,
    [oid]
  );
  const args = [
    oid,
    String(provider || ""),
    Math.max(0, Math.floor(Number(freightQuoteCents) || 0)),
    String(shipmentId || ""),
    String(trackingCode || ""),
    String(deliveryStatus || ""),
    String(rawPayload || "{}"),
  ];
  if (row) {
    runExec(
      `UPDATE order_logistics
       SET provider=?, freight_quote_cents=?, shipment_id=?, tracking_code=?, delivery_status=?, last_sync_at=datetime('now'), raw_payload=?, updated_at=datetime('now')
       WHERE external_order_id=?`,
      [args[1], args[2], args[3], args[4], args[5], args[6], args[0]]
    );
  } else {
    runExec(
      `INSERT INTO order_logistics (external_order_id, provider, freight_quote_cents, shipment_id, tracking_code, delivery_status, last_sync_at, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
      args
    );
  }
  persist();
  return runGet(`SELECT * FROM order_logistics WHERE external_order_id = ?`, [oid]);
}

export function getOrderLogistics(externalOrderId) {
  return runGet(`SELECT * FROM order_logistics WHERE external_order_id = ?`, [
    String(externalOrderId || ""),
  ]);
}

export function listOrderLogistics(limit = 200) {
  const lim = Math.min(1000, Math.max(1, Math.floor(Number(limit) || 200)));
  return runAll(
    `SELECT * FROM order_logistics ORDER BY datetime(updated_at) DESC LIMIT ?`,
    [lim]
  );
}

export function addOrderTimelineEvent({
  externalOrderId,
  eventKey,
  title,
  detail = "",
  payloadJson = "{}",
}) {
  runExec(
    `INSERT INTO order_timeline_events (external_order_id, event_key, title, detail, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(externalOrderId || ""),
      String(eventKey || ""),
      String(title || ""),
      String(detail || ""),
      String(payloadJson || "{}"),
    ]
  );
  if (db.getRowsModified() > 0) persist();
}

export function listOrderTimelineEvents(externalOrderId) {
  return runAll(
    `SELECT * FROM order_timeline_events
     WHERE external_order_id = ?
     ORDER BY id ASC`,
    [String(externalOrderId || "")]
  );
}

export function trackVisitEvent({
  sessionId,
  path,
  referrer = "",
  ip = "",
  userAgent = "",
  deviceType = "",
  country = "",
  city = "",
}) {
  runExec(
    `INSERT INTO visit_events (session_id, path, referrer, ip, user_agent, device_type, country, city)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(sessionId || ""),
      String(path || "/"),
      String(referrer || ""),
      String(ip || ""),
      String(userAgent || ""),
      String(deviceType || ""),
      String(country || ""),
      String(city || ""),
    ]
  );
}

export function touchOnlineSession({ sessionId, path, ip = "", userAgent = "" }) {
  const sid = String(sessionId || "").trim();
  if (!sid) return;
  const row = runGet(`SELECT session_id FROM online_sessions WHERE session_id = ?`, [sid]);
  if (row) {
    runExec(
      `UPDATE online_sessions
       SET path = ?, ip = ?, user_agent = ?, last_seen_at = datetime('now')
       WHERE session_id = ?`,
      [String(path || "/"), String(ip || ""), String(userAgent || ""), sid]
    );
  } else {
    runExec(
      `INSERT INTO online_sessions (session_id, path, ip, user_agent, last_seen_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [sid, String(path || "/"), String(ip || ""), String(userAgent || "")]
    );
  }
}

export function cleanupOnlineSessions(maxAgeSeconds = 180) {
  const s = Math.max(30, Math.floor(Number(maxAgeSeconds) || 180));
  runExec(
    `DELETE FROM online_sessions
     WHERE (strftime('%s','now') - strftime('%s', last_seen_at)) > ?`,
    [s]
  );
}

export function listOnlineSessions(limit = 100) {
  cleanupOnlineSessions(180);
  const lim = Math.min(500, Math.max(1, Math.floor(Number(limit) || 100)));
  return runAll(
    `SELECT * FROM online_sessions ORDER BY datetime(last_seen_at) DESC LIMIT ?`,
    [lim]
  );
}

export function visitCountsPerDay(days = 30) {
  const d = Math.min(365, Math.max(1, Math.floor(Number(days) || 30)));
  return runAll(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS visits
     FROM visit_events
     WHERE created_at >= datetime('now', ?)
     GROUP BY substr(created_at, 1, 10)
     ORDER BY day ASC`,
    [`-${d} days`]
  );
}

export function createSupportChat({
  customerEmail = "",
  customerSessionId = "",
  subject = "",
  reasonCategory = "",
  reasonDetail = "",
}) {
  runExec(
    `INSERT INTO support_chats (
      customer_email, customer_session_id, subject, reason_category, reason_detail, status
    ) VALUES (?, ?, ?, ?, ?, 'OPEN')`,
    [
      String(customerEmail || "").trim().toLowerCase(),
      String(customerSessionId || ""),
      String(subject || "").slice(0, 240),
      String(reasonCategory || "").trim().slice(0, 80),
      String(reasonDetail || "").trim().slice(0, 240),
    ]
  );
  const id = lastInsertRowid();
  persist();
  return runGet(`SELECT * FROM support_chats WHERE id = ?`, [id]);
}

export function listSupportChats({ status = "", limit = 50, offset = 0 } = {}) {
  const lim = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  const st = String(status || "").trim().toUpperCase();
  const baseSelect = `
      SELECT c.*,
        (SELECT body FROM support_messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_body,
        (SELECT sender_role FROM support_messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_sender_role,
        (SELECT created_at FROM support_messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
        CASE
          WHEN c.last_customer_message_at IS NOT NULL
               AND (c.admin_last_read_at IS NULL OR c.last_customer_message_at > c.admin_last_read_at)
          THEN 1 ELSE 0
        END AS unread_admin
      FROM support_chats c
  `;
  const orderBy = `ORDER BY unread_admin DESC, c.updated_at DESC, c.id DESC`;
  if (st) {
    return runAll(
      `${baseSelect} WHERE c.status = ? ${orderBy} LIMIT ? OFFSET ?`,
      [st, lim, off]
    );
  }
  return runAll(
    `${baseSelect} ${orderBy} LIMIT ? OFFSET ?`,
    [lim, off]
  );
}

export function getSupportChatById(chatId) {
  return runGet(`SELECT * FROM support_chats WHERE id = ?`, [
    Math.floor(Number(chatId) || 0),
  ]);
}

export function addSupportMessage({
  chatId,
  senderRole,
  senderEmail = "",
  body,
}) {
  const cid = Math.floor(Number(chatId));
  if (!Number.isInteger(cid) || cid < 1) throw new Error("Chat inválido.");
  const txt = String(body || "").trim();
  if (!txt) throw new Error("Mensagem vazia.");
  runExec(
    `INSERT INTO support_messages (chat_id, sender_role, sender_email, body)
     VALUES (?, ?, ?, ?)`,
    [cid, String(senderRole || ""), String(senderEmail || ""), txt.slice(0, 4000)]
  );
  const role = String(senderRole || "").toUpperCase();
  if (role === "ADMIN") {
    runExec(
      `UPDATE support_chats
       SET status = 'OPEN',
           last_admin_message_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [cid]
    );
  } else {
    runExec(
      `UPDATE support_chats
       SET status = 'OPEN',
           last_customer_message_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [cid]
    );
  }
  persist();
  return runGet(`SELECT * FROM support_messages WHERE id = last_insert_rowid()`, []);
}

export function listSupportMessages(chatId) {
  return runAll(
    `SELECT * FROM support_messages WHERE chat_id = ? ORDER BY id ASC`,
    [Math.floor(Number(chatId) || 0)]
  );
}

export function updateSupportChatStatus(chatId, status) {
  const next = String(status || "OPEN").toUpperCase();
  const closeStatuses = new Set(["CLOSED", "RESOLVED", "AUTO_CLOSED"]);
  runExec(
    `UPDATE support_chats
     SET status = ?,
         closed_at = CASE WHEN ? THEN datetime('now') ELSE NULL END,
         updated_at = datetime('now')
     WHERE id = ?`,
    [next, closeStatuses.has(next) ? 1 : 0, Math.floor(Number(chatId) || 0)]
  );
  if (db.getRowsModified() > 0) persist();
}

export function markSupportChatAdminRead(chatId) {
  runExec(
    `UPDATE support_chats
     SET admin_last_read_at = datetime('now'), updated_at = updated_at
     WHERE id = ?`,
    [Math.floor(Number(chatId) || 0)]
  );
  if (db.getRowsModified() > 0) persist();
}

export function closeSupportChatsIdleNoCustomerReply(minutes = 15) {
  const mins = Math.max(1, Math.floor(Number(minutes) || 15));
  runExec(
    `UPDATE support_chats
     SET status = 'AUTO_CLOSED',
         closed_at = datetime('now'),
         updated_at = datetime('now')
     WHERE status = 'OPEN'
       AND last_admin_message_at IS NOT NULL
       AND (last_customer_message_at IS NULL OR last_customer_message_at < last_admin_message_at)
       AND last_admin_message_at <= datetime('now', ?)`,
    [`-${mins} minutes`]
  );
  const changed = runGet(`SELECT changes() AS n`, []);
  const n = Number(changed?.n || 0);
  if (n > 0) persist();
  return n;
}
