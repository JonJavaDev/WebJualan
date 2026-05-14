import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import QRCode from "qrcode";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const MAIN_PAGE_PATH = path.join(appRoot, "Main_Page.html");

app.use(express.static(appRoot));

const PORT = Number(process.env.PORT) || 3000;

// Attempt to connect to database but don't crash server if DB is down.
let DB_READY = false;

function buildDbConfig() {
  const host = process.env.DB_HOST || "localhost";
  const database = process.env.DB_NAME || "webjualan";
  const port = Number(process.env.DB_PORT) || 3306;
  const user = String(process.env.DB_USER || "").trim();
  const password = String(process.env.DB_PASSWORD || "");

  const config = {
    host,
    port,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  if (user) {
    config.user = user;
  }
  if (password) {
    config.password = password;
  }

  return config;
}

const pool = mysql.createPool(buildDbConfig());

const poolConnect = pool
  .getConnection()
  .then((conn) => {
    DB_READY = true;
    console.log("DB connected");
    conn.release();
  })
  .catch((err) => {
    DB_READY = false;
    console.error("DB connection failed (continuing in degraded mode):", err && err.message ? err.message : err);
  });

const PREORDER_ONLY_START = { month: 4, day: 10 };
const PREORDER_ONLY_END = { month: 4, day: 21 };
const PREORDER_ONLY_ENABLED =
  String(process.env.PREORDER_ONLY_ENABLED || "false") === "true";
const PREORDER_ONLY_MESSAGE =
  "Order langsung belum tersedia pada periode 10-21 Mei. Silakan gunakan preorder.";

const MENU_ITEMS = {
  hemat: {
    id: "hemat",
    name: "Paket Hemat",
    price: 13000,
    desc: "Mie Chili Oil + Es Teh",
  },
  regular: {
    id: "regular",
    name: "Paket Regular",
    price: 15000,
    desc: "Mie Chili + Pangsit + free es Teh",
  },
  sultan: {
    id: "sultan",
    name: "Paket Sultan",
    price: 20000,
    desc: "Mie Chili + Pangmi + Pangsit + free es Teh",
  },
};

const PAYMENT_METHODS = new Set(["qris", "cash"]);
const PREORDER_STATUS = {
  pending: "pending",
  confirmed: "confirmed",
  completed: "completed",
  canceled: "canceled",
};
const PREORDER_EXPIRE_MINUTES = 10;
const PREORDER_AUTO_CANCEL_ENABLED =
  String(process.env.PREORDER_AUTO_CANCEL_ENABLED || "false") === "true";
const ADMIN_KEY = String(process.env.ADMIN_KEY || "").trim();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateCode = (length) => {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
};

const generateUniqueCode = async (table, column, length) => {
  await poolConnect;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode(length);
    const [rows] = await pool.execute(
      `SELECT 1 AS found FROM ${table} WHERE ${column} = ?`,
      [code]
    );
    if (!rows.length) {
      return code;
    }
  }
  throw new Error("Gagal membuat kode unik.");
};

const isFullName = (value) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length >= 2;
};

const normalizePhone = (value) => {
  return String(value || "").replace(/\D/g, "");
};

const isValidPhone = (value) => {
  const digits = normalizePhone(value);
  return digits.length >= 9 && digits.length <= 15;
};

const buildItemsPayload = (itemsInput, fallbackItemId, fallbackQty) => {
  const rawItems = Array.isArray(itemsInput) && itemsInput.length
    ? itemsInput
    : fallbackItemId
      ? [{ itemId: fallbackItemId, quantity: fallbackQty }]
      : [];

  if (!rawItems.length) {
    return { error: "Keranjang masih kosong." };
  }

  const merged = new Map();
  for (const entry of rawItems) {
    const itemId = String(entry.itemId || entry.id || "").trim();
    const qty = parseInt(entry.quantity, 10);
    if (!itemId || !MENU_ITEMS[itemId]) {
      return { error: "Menu tidak ditemukan." };
    }
    if (!Number.isInteger(qty) || qty < 1) {
      return { error: "Jumlah tidak valid." };
    }
    merged.set(itemId, (merged.get(itemId) || 0) + qty);
  }

  const items = Array.from(merged.entries()).map(([itemId, quantity]) => {
    const item = MENU_ITEMS[itemId];
    return {
      itemId,
      name: item.name,
      price: item.price,
      quantity,
    };
  });

  const totalItems = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const summaryName =
    items.length === 1
      ? items[0].name
      : `${items[0].name} + ${items.length - 1} item`;

  return {
    items,
    totalItems,
    total,
    summaryName,
    primaryItemId: items[0].itemId,
    primaryPrice: items[0].price,
    itemsJson: JSON.stringify(items),
  };
};

const parseItemsFromRow = (row) => {
  if (row && row.items_json) {
    try {
      const parsed = JSON.parse(row.items_json);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch (error) {
      return [];
    }
  }

  if (row && row.item_id && row.item_name) {
    return [
      {
        itemId: row.item_id,
        name: row.item_name,
        price: Number(row.price),
        quantity: Number(row.quantity) || 1,
      },
    ];
  }

  return [];
};

const sumItemQtyFromRow = (items, fallbackQty) => {
  if (!Array.isArray(items) || !items.length) {
    return Number.isFinite(fallbackQty) ? Number(fallbackQty) : 0;
  }
  return items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );
};

const isWithinPreorderWindow = (date = new Date()) => {
  const year = date.getFullYear();
  const start = new Date(
    year,
    PREORDER_ONLY_START.month,
    PREORDER_ONLY_START.day,
    0,
    0,
    0,
    0
  );
  const end = new Date(
    year,
    PREORDER_ONLY_END.month,
    PREORDER_ONLY_END.day,
    23,
    59,
    59,
    999
  );
  return date >= start && date <= end;
};

const isPreorderExpired = (preorder) => {
  if (!PREORDER_AUTO_CANCEL_ENABLED) {
    return false;
  }
  if (!preorder) {
    return false;
  }
  if (preorder.payment_method !== "qris") {
    return false;
  }
  if (preorder.status !== PREORDER_STATUS.pending) {
    return false;
  }
  if (preorder.payment_proof) {
    return false;
  }
  const createdAt = new Date(preorder.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }
  const expiresAt = createdAt.getTime() + PREORDER_EXPIRE_MINUTES * 60000;
  return Date.now() > expiresAt;
};

const cancelPreorder = async (id) => {
  await poolConnect;
  await pool.execute(
    "UPDATE preorders SET status = ? WHERE id = ?",
    [PREORDER_STATUS.canceled, id]
  );
};

const expireStalePreorders = async () => {
  if (!PREORDER_AUTO_CANCEL_ENABLED) {
    return;
  }
  await poolConnect;
  await pool.execute(
    "UPDATE preorders SET status = ? WHERE status = ? AND payment_method = ? AND payment_proof IS NULL AND DATE_ADD(created_at, INTERVAL ? MINUTE) < NOW()",
    [PREORDER_STATUS.canceled, PREORDER_STATUS.pending, "qris", PREORDER_EXPIRE_MINUTES]
  );
};

const requireAdminKey = (req, res, next) => {
  if (!ADMIN_KEY) {
    return res.status(500).json({ error: "Admin key belum diset." });
  }

  const key = String(req.header("x-admin-key") || "");
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Akses ditolak." });
  }

  return next();
};

const normalizeOrder = (row) => {
  const items = parseItemsFromRow(row);
  return {
    id: row.id,
    publicId: row.public_id,
    sequenceNumber: row.id,
    name: row.name,
    phone: row.phone,
    className: row.class_name,
    itemId: row.item_id,
    itemName: row.item_name,
    price: Number(row.price),
    quantity: Number(row.quantity),
    items,
    totalItems: sumItemQtyFromRow(items, row.quantity),
    paymentMethod: row.payment_method,
    queueNumber: row.queue_number === null ? null : Number(row.queue_number),
    queueCode: row.queue_code,
    queueStatus: row.queue_status,
    isPreorder: Boolean(row.is_preorder),
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
};

const normalizePreorder = (row) => {
  const items = parseItemsFromRow(row);
  return {
    id: row.id,
    publicId: row.public_id,
    sequenceNumber: row.id,
    name: row.name,
    phone: row.phone,
    className: row.class_name,
    level: row.level,
    note: row.note,
    itemId: row.item_id,
    itemName: row.item_name,
    price: Number(row.price),
    quantity: Number(row.quantity),
    items,
    totalItems: sumItemQtyFromRow(items, row.quantity),
    paymentMethod: row.payment_method,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    paymentProofAvailable: Boolean(
      row.payment_proof_available ?? row.payment_proof
    ),
    paymentProofName: row.payment_proof_name || null,
    paymentProofUploadedAt: row.payment_proof_uploaded_at || null,
  };
};

const normalizeOrderPublic = (row) => {
  const items = parseItemsFromRow(row);
  return {
    id: row.public_id,
    sequenceNumber: row.id,
    name: row.name,
    phone: row.phone,
    className: row.class_name,
    itemId: row.item_id,
    itemName: row.item_name,
    price: Number(row.price),
    quantity: Number(row.quantity),
    items,
    totalItems: sumItemQtyFromRow(items, row.quantity),
    paymentMethod: row.payment_method,
    queueStatus: row.queue_status,
    isPreorder: Boolean(row.is_preorder),
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
};

const normalizePreorderPublic = (row) => {
  const items = parseItemsFromRow(row);
  return {
    id: row.public_id,
    sequenceNumber: row.id,
    name: row.name,
    phone: row.phone,
    className: row.class_name,
    level: row.level,
    note: row.note,
    itemId: row.item_id,
    itemName: row.item_name,
    price: Number(row.price),
    quantity: Number(row.quantity),
    items,
    totalItems: sumItemQtyFromRow(items, row.quantity),
    paymentMethod: row.payment_method,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    paymentProofAvailable: Boolean(row.payment_proof),
    paymentProofName: row.payment_proof_name || null,
    paymentProofUploadedAt: row.payment_proof_uploaded_at || null,
  };
};

const getOrderById = async (id) => {
  await poolConnect;
  const [rows] = await pool.execute(
    "SELECT * FROM orders WHERE id = ?",
    [id]
  );
  return rows[0] || null;
};

const getOrderByPublicId = async (publicId) => {
  await poolConnect;
  const [rows] = await pool.execute(
    "SELECT * FROM orders WHERE public_id = ?",
    [publicId]
  );
  return rows[0] || null;
};

const getPreorderById = async (id) => {
  await poolConnect;
  const [rows] = await pool.execute(
    "SELECT * FROM preorders WHERE id = ?",
    [id]
  );
  return rows[0] || null;
};

const getPreorderByPublicId = async (publicId) => {
  await poolConnect;
  const [rows] = await pool.execute(
    "SELECT * FROM preorders WHERE public_id = ?",
    [publicId]
  );
  return rows[0] || null;
};

const getActivePreorderByIdentity = async (name, className) => {
  await poolConnect;
  const [rows] = await pool.execute(
    "SELECT * FROM preorders WHERE name = ? AND class_name = ? AND status = ? ORDER BY created_at DESC LIMIT 1",
    [name, className, PREORDER_STATUS.pending]
  );
  return rows[0] || null;
};

const getNextQueueNumber = async (conn) => {
  const [rows] = await conn.execute(
    "SELECT COALESCE(MAX(queue_number), 0) + 1 AS nextQueue FROM orders WHERE queue_number IS NOT NULL"
  );
  return rows[0].nextQueue;
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/qr/:text", async (req, res) => {
  try {
    const text = String(req.params.text || "").trim();
    if (!text) {
      return res.status(400).json({ error: "QR text tidak valid." });
    }
    const dataUrl = await QRCode.toDataURL(text, {
      margin: 1,
      width: 240,
      color: {
        dark: "#1d1a16",
        light: "#ffffff",
      },
    });
    return res.json({ dataUrl });
  } catch (error) {
    console.error("Failed to generate QR:", error);
    return res.status(500).json({ error: "Gagal membuat QR." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(MAIN_PAGE_PATH);
});

app.post("/api/orders", async (req, res) => {
  try {
    if (PREORDER_ONLY_ENABLED && isWithinPreorderWindow()) {
      return res.status(403).json({ error: PREORDER_ONLY_MESSAGE });
    }
    const name = String(req.body.name || "").trim();
    const phone = normalizePhone(req.body.phone || "");
    const className = String(req.body.className || "").trim();
    const itemId = String(req.body.itemId || "").trim();
    const quantity = parseInt(req.body.quantity, 10);
    const paymentMethod = String(req.body.paymentMethod || "").toLowerCase();

    if (!name) {
      return res.status(400).json({ error: "Nama wajib diisi." });
    }

    if (!isFullName(name)) {
      return res
        .status(400)
        .json({ error: "Nama harus diisi lengkap (nama depan dan belakang)." });
    }

    if (!phone) {
      return res.status(400).json({ error: "Nomor telepon wajib diisi." });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: "Nomor telepon tidak valid." });
    }

    if (!className) {
      return res.status(400).json({ error: "Kelas wajib dipilih." });
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: "Metode pembayaran tidak valid." });
    }

    const itemsResult = buildItemsPayload(req.body.items, itemId, quantity);
    if (itemsResult.error) {
      return res.status(400).json({ error: itemsResult.error });
    }

    const {
      totalItems,
      total,
      summaryName,
      primaryItemId,
      primaryPrice,
      itemsJson,
    } = itemsResult;

    const status = paymentMethod === "qris" ? "pending_qris" : "pending_cash";
    const publicId = await generateUniqueCode("orders", "public_id", 10);
    const queueCode = await generateUniqueCode("orders", "queue_code", 6);

    await poolConnect;
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      const nextQueue = await getNextQueueNumber(conn);
      const [result] = await conn.execute(
        "INSERT INTO orders (public_id, name, phone, class_name, item_id, item_name, price, quantity, items_json, payment_method, total, status, queue_number, queue_code, queue_status, is_preorder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [publicId, name, phone, className, primaryItemId, summaryName, primaryPrice, totalItems, itemsJson, paymentMethod, total, status, nextQueue, queueCode, "waiting", 0]
      );

      await conn.commit();
      conn.release();

      return res.json({
        id: publicId,
        total,
        status,
        paymentMethod,
        sequenceNumber: result.insertId,
      });
    } catch (error) {
      await conn.rollback();
      conn.release();
      throw error;
    }
  } catch (error) {
    console.error("Failed to create order:", error);
    return res.status(500).json({ error: "Gagal membuat pesanan." });
  }
});

app.post("/api/preorders", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = normalizePhone(req.body.phone || "");
    const className = String(req.body.className || "").trim();
    const level = parseInt(req.body.level, 10);
    const note = String(req.body.note || "").trim();
    const itemId = String(req.body.itemId || "").trim();
    const quantity = parseInt(req.body.quantity, 10);
    const paymentMethod = String(req.body.paymentMethod || "").toLowerCase();

    if (!name) {
      return res.status(400).json({ error: "Nama wajib diisi." });
    }

    if (!isFullName(name)) {
      return res
        .status(400)
        .json({ error: "Nama harus diisi lengkap (nama depan dan belakang)." });
    }

    if (!phone) {
      return res.status(400).json({ error: "Nomor telepon wajib diisi." });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: "Nomor telepon tidak valid." });
    }

    if (!className) {
      return res.status(400).json({ error: "Kelas wajib dipilih." });
    }

    if (!Number.isInteger(level) || level < 0 || level > 5) {
      return res.status(400).json({ error: "Level wajib dipilih (0-5)." });
    }

    if (note.length > 255) {
      return res.status(400).json({ error: "Catatan maksimal 255 karakter." });
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: "Metode pembayaran tidak valid." });
    }

    const itemsResult = buildItemsPayload(req.body.items, itemId, quantity);
    if (itemsResult.error) {
      return res.status(400).json({ error: itemsResult.error });
    }

    const {
      totalItems,
      total,
      summaryName,
      primaryItemId,
      primaryPrice,
      itemsJson,
    } = itemsResult;

    const activePreorder = await getActivePreorderByIdentity(name, className);
    if (activePreorder) {
      return res.status(409).json({
        error:
          "Kamu masih punya preorder aktif. Tunggu sampai dikonfirmasi dulu ya.",
        existingId: activePreorder.id,
      });
    }

    const status = PREORDER_STATUS.pending;
    const publicId = await generateUniqueCode("preorders", "public_id", 10);

    await poolConnect;
    const [result] = await pool.execute(
      "INSERT INTO preorders (public_id, name, phone, class_name, `level`, note, item_id, item_name, price, quantity, items_json, payment_method, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [publicId, name, phone, className, level, note || null, primaryItemId, summaryName, primaryPrice, totalItems, itemsJson, paymentMethod, total, status]
    );

    return res.json({
      id: publicId,
      total,
      status,
      paymentMethod,
      sequenceNumber: result.insertId,
    });
  } catch (error) {
    console.error("Failed to create preorder:", error);
    return res.status(500).json({ error: "Gagal membuat preorder." });
  }
});

app.get("/api/preorders/:id", async (req, res) => {
  try {
    const publicId = String(req.params.id || "").trim();
    if (!publicId) {
      return res.status(400).json({ error: "Preorder ID tidak valid." });
    }

    await expireStalePreorders();

    const preorder = await getPreorderByPublicId(publicId);
    if (!preorder) {
      return res.status(404).json({ error: "Preorder tidak ditemukan." });
    }

    if (isPreorderExpired(preorder)) {
      await cancelPreorder(preorder.id);
      preorder.status = PREORDER_STATUS.canceled;
    }

    return res.json(normalizePreorderPublic(preorder));
  } catch (error) {
    console.error("Failed to fetch preorder:", error);
    return res.status(500).json({ error: "Gagal memuat preorder." });
  }
});

app.post(
  "/api/preorders/:id/payment-proof",
  upload.single("proof"),
  async (req, res) => {
    try {
      const publicId = String(req.params.id || "").trim();
      if (!publicId) {
        return res.status(400).json({ error: "Preorder ID tidak valid." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "File bukti belum dipilih." });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "File harus berupa gambar." });
      }

      await expireStalePreorders();

      const preorder = await getPreorderByPublicId(publicId);
      if (!preorder) {
        return res.status(404).json({ error: "Preorder tidak ditemukan." });
      }

      if (preorder.status === PREORDER_STATUS.canceled || isPreorderExpired(preorder)) {
        if (preorder.status !== PREORDER_STATUS.canceled) {
          await cancelPreorder(preorder.id);
        }
        return res
          .status(410)
          .json({
            error:
              "Preorder dibatalkan karena bukti pembayaran tidak diunggah dalam 10 menit.",
          });
      }

      if (preorder.payment_method !== "qris") {
        return res
          .status(400)
          .json({ error: "Pesanan ini bukan QRIS." });
      }

      await poolConnect;
      const uploadedAt = new Date();
      await pool.execute(
        "UPDATE preorders SET payment_proof = ?, payment_proof_type = ?, payment_proof_name = ?, payment_proof_uploaded_at = ? WHERE id = ?",
        [req.file.buffer, req.file.mimetype, req.file.originalname, uploadedAt, preorder.id]
      );

      return res.json({ status: "uploaded", uploadedAt });
    } catch (error) {
      console.error("Failed to upload payment proof:", error);
      return res
        .status(500)
        .json({ error: "Gagal mengunggah bukti pembayaran." });
    }
  }
);

app.get("/api/orders/:id", async (req, res) => {
  try {
    const publicId = String(req.params.id || "").trim();
    if (!publicId) {
      return res.status(400).json({ error: "Order ID tidak valid." });
    }

    const order = await getOrderByPublicId(publicId);
    if (!order) {
      return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    }

    return res.json(normalizeOrderPublic(order));
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return res.status(500).json({ error: "Gagal memuat pesanan." });
  }
});

app.get("/api/admin/orders", requireAdminKey, async (req, res) => {
  try {
    const statusFilter = String(req.query.status || "").trim();
    await poolConnect;

    let query = "SELECT * FROM orders";
    const params = [];

    if (statusFilter) {
      query += " WHERE status = ?";
      params.push(statusFilter);
    }

    query += " ORDER BY created_at DESC";
    const [rows] = await pool.execute(query, params);

    return res.json(rows.map(normalizeOrder));
  } catch (error) {
    console.error("Failed to list orders:", error);
    return res.status(500).json({ error: "Gagal memuat daftar pesanan." });
  }
});

app.get("/api/admin/preorders", requireAdminKey, async (req, res) => {
  try {
    const statusFilter = String(req.query.status || "").trim();
    await expireStalePreorders();
    await poolConnect;

    let query =
      "SELECT id, public_id, name, phone, class_name, `level` AS level, note, item_id, item_name, price, quantity, items_json, payment_method, total, status, created_at, payment_proof_name, payment_proof_uploaded_at, CASE WHEN payment_proof IS NULL THEN 0 ELSE 1 END AS payment_proof_available FROM preorders WHERE status <> ?";
    const params = [PREORDER_STATUS.canceled];

    if (statusFilter) {
      query += " AND status = ?";
      params.push(statusFilter);
    }

    query += " ORDER BY created_at DESC";
    const [rows] = await pool.execute(query, params);

    return res.json(rows.map(normalizePreorder));
  } catch (error) {
    console.error("Failed to list preorders:", error);
    return res.status(500).json({ error: "Gagal memuat daftar preorder." });
  }
});

app.get(
  "/api/admin/preorders/:id/payment-proof",
  requireAdminKey,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "Preorder ID tidak valid." });
      }

      await poolConnect;
      const [rows] = await pool.execute(
        "SELECT public_id, name, payment_proof, payment_proof_type, payment_proof_name, payment_proof_uploaded_at FROM preorders WHERE id = ?",
        [id]
      );

      const row = rows[0];
      if (!row) {
        return res.status(404).json({ error: "Preorder tidak ditemukan." });
      }

      if (!row.payment_proof) {
        return res
          .status(404)
          .json({ error: "Bukti pembayaran belum tersedia." });
      }

      return res.json({
        publicId: row.public_id,
        name: row.name,
        fileName: row.payment_proof_name,
        contentType: row.payment_proof_type || "image/jpeg",
        uploadedAt: row.payment_proof_uploaded_at,
        data: Buffer.from(row.payment_proof).toString("base64"),
      });
    } catch (error) {
      console.error("Failed to load payment proof:", error);
      return res.status(500).json({ error: "Gagal memuat bukti QRIS." });
    }
  }
);

app.post("/api/admin/orders/:id/mark-paid", requireAdminKey, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Order ID tidak valid." });
    }

    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    }

    if (order.status !== "paid") {
      await poolConnect;
      await pool.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        ["paid", id]
      );
    }

    return res.json({ status: "paid" });
  } catch (error) {
    console.error("Failed to mark paid:", error);
    return res.status(500).json({ error: "Gagal konfirmasi pesanan." });
  }
});

app.post(
  "/api/admin/orders/:id/mark-served",
  requireAdminKey,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "Order ID tidak valid." });
      }

      const order = await getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: "Pesanan tidak ditemukan." });
      }

      if (order.queue_status !== "served") {
        await poolConnect;
        await pool.execute(
          "UPDATE orders SET queue_status = ? WHERE id = ?",
          ["served", id]
        );
      }

      return res.json({ queueStatus: "served" });
    } catch (error) {
      console.error("Failed to mark served:", error);
      return res.status(500).json({ error: "Gagal menandai antrian." });
    }
  }
);

app.post(
  "/api/admin/preorders/:id/mark-confirmed",
  requireAdminKey,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "Preorder ID tidak valid." });
      }

      const preorder = await getPreorderById(id);
      if (!preorder) {
        return res.status(404).json({ error: "Preorder tidak ditemukan." });
      }

      if (preorder.status !== PREORDER_STATUS.confirmed) {
        await poolConnect;
        await pool.execute(
          "UPDATE preorders SET status = ? WHERE id = ?",
          [PREORDER_STATUS.confirmed, id]
        );
      }

      return res.json({ status: PREORDER_STATUS.confirmed });
    } catch (error) {
      console.error("Failed to mark preorder confirmed:", error);
      return res
        .status(500)
        .json({ error: "Gagal konfirmasi preorder." });
    }
  }
);

app.post(
  "/api/admin/preorders/:id/mark-completed",
  requireAdminKey,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "Preorder ID tidak valid." });
      }

      const preorder = await getPreorderById(id);
      if (!preorder) {
        return res.status(404).json({ error: "Preorder tidak ditemukan." });
      }

      if (preorder.status !== PREORDER_STATUS.completed) {
        await poolConnect;
        await pool.execute(
          "UPDATE preorders SET status = ? WHERE id = ?",
          [PREORDER_STATUS.completed, id]
        );
      }

      return res.json({ status: PREORDER_STATUS.completed });
    } catch (error) {
      console.error("Failed to mark preorder completed:", error);
      return res
        .status(500)
        .json({ error: "Gagal menandai preorder selesai." });
    }
  }
);

app.post("/api/admin/cleanup-test-orders", requireAdminKey, async (req, res) => {
  try {
    await poolConnect;

    // Only keep exact name matches for raffi darmawan and Elfara Dwi Adyastalita
    const [toDelete] = await pool.execute(`
      SELECT id FROM preorders
      WHERE LOWER(name) NOT IN (LOWER('raffi darmawan'), LOWER('Elfara Dwi Adyastalita'))
    `);

    const deleteIds = toDelete.map((r) => r.id);
    let deletedCount = 0;

    if (deleteIds.length > 0) {
      // Delete the test data
      const placeholders = deleteIds.map(() => "?").join(",");
      const deleteQuery = `DELETE FROM preorders WHERE id IN (${placeholders})`;
      const result = await pool.execute(deleteQuery, deleteIds);
      deletedCount = result.affectedRows || 0;
    }

    // Get remaining count
    const [remaining] = await pool.execute("SELECT COUNT(*) as count FROM preorders");

    const remainingCount = remaining[0]?.count || 0;

    return res.json({
      deleted: deletedCount,
      remaining: remainingCount,
      message: "Pembersihan selesai",
    });
  } catch (error) {
    console.error("Failed to cleanup test orders:", error);
    return res
      .status(500)
      .json({ error: "Gagal membersihkan data test." });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Ukuran file maksimal 4 MB."
        : "Gagal mengunggah bukti pembayaran.";
    return res.status(400).json({ error: message });
  }
  return next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

setInterval(() => {
  if (PREORDER_AUTO_CANCEL_ENABLED) {
    expireStalePreorders().catch((error) => {
      console.error("Failed to expire preorders:", error);
    });
  }
}, 60000);
