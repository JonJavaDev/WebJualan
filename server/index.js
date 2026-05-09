import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import sql from "mssql/msnodesqlv8.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

const buildWindowsAuthConfig = () => {
  const host = process.env.DB_HOST || "localhost";
  const instance = process.env.DB_INSTANCE || "";
  const database = process.env.DB_NAME || "webjualan";
  const server = instance ? `${host}\\${instance}` : host;
  const encrypt = String(process.env.DB_ENCRYPT || "false") === "true";
  const trustCert = String(process.env.DB_TRUST_CERT || "true") === "true";

  return {
    connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=${encrypt ? "Yes" : "No"};TrustServerCertificate=${trustCert ? "Yes" : "No"};`,
  };
};

const pool = new sql.ConnectionPool(buildWindowsAuthConfig());

const poolConnect = pool.connect();

const MENU_ITEMS = {
  hemat: {
    id: "hemat",
    name: "Paket Hemat",
    price: 13000,
    desc: "Mie Chili Oil + free es Teh",
  },
  regular: {
    id: "regular",
    name: "Paket Regular",
    price: 15000,
    desc: "Mie Chili + Pangsit + Es Teh",
  },
  sultan: {
    id: "sultan",
    name: "Paket Sultan",
    price: 20000,
    desc: "Mie Chili + Pangmi + Pangsit + Es Teh",
  },
};

const PAYMENT_METHODS = new Set(["qris", "cash"]);
const ADMIN_KEY = String(process.env.ADMIN_KEY || "").trim();

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

const normalizeOrder = (row) => ({
  id: row.id,
  name: row.name,
  itemId: row.item_id,
  itemName: row.item_name,
  price: Number(row.price),
  quantity: Number(row.quantity),
  paymentMethod: row.payment_method,
  queueNumber: row.queue_number === null ? null : Number(row.queue_number),
  queueStatus: row.queue_status,
  isPreorder: Boolean(row.is_preorder),
  total: Number(row.total),
  status: row.status,
  createdAt: row.created_at,
});

const getOrderById = async (id) => {
  await poolConnect;
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query("SELECT * FROM orders WHERE id = @id");
  return result.recordset[0] || null;
};

const getNextQueueNumber = async (transaction) => {
  const result = await new sql.Request(transaction).query(
    "SELECT ISNULL(MAX(queue_number), 0) + 1 AS nextQueue FROM orders WITH (UPDLOCK, HOLDLOCK) WHERE queue_number IS NOT NULL"
  );
  return result.recordset[0].nextQueue;
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.send("WebJualan API is running. Use /api/health to check status.");
});

app.post("/api/orders", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const itemId = String(req.body.itemId || "").trim();
    const quantity = parseInt(req.body.quantity, 10);
    const paymentMethod = String(req.body.paymentMethod || "").toLowerCase();

    if (!name) {
      return res.status(400).json({ error: "Nama wajib diisi." });
    }

    const item = MENU_ITEMS[itemId];
    if (!item) {
      return res.status(400).json({ error: "Menu tidak ditemukan." });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "Jumlah tidak valid." });
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: "Metode pembayaran tidak valid." });
    }

    const status = paymentMethod === "qris" ? "pending_qris" : "pending_cash";
    const total = item.price * quantity;

    await poolConnect;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const nextQueue = await getNextQueueNumber(transaction);
      const result = await new sql.Request(transaction)
        .input("name", sql.NVarChar(100), name)
        .input("itemId", sql.NVarChar(50), item.id)
        .input("itemName", sql.NVarChar(100), item.name)
        .input("price", sql.Int, item.price)
        .input("quantity", sql.Int, quantity)
        .input("paymentMethod", sql.NVarChar(10), paymentMethod)
        .input("total", sql.Int, total)
        .input("status", sql.NVarChar(20), status)
        .input("queueNumber", sql.Int, nextQueue)
        .input("queueStatus", sql.NVarChar(20), "waiting")
        .input("isPreorder", sql.Bit, 0)
        .query(
          "INSERT INTO orders (name, item_id, item_name, price, quantity, payment_method, total, status, queue_number, queue_status, is_preorder) OUTPUT Inserted.id, Inserted.queue_number VALUES (@name, @itemId, @itemName, @price, @quantity, @paymentMethod, @total, @status, @queueNumber, @queueStatus, @isPreorder)"
        );

      await transaction.commit();

      return res.json({
        id: result.recordset[0].id,
        total,
        status,
        paymentMethod,
        queueNumber: result.recordset[0].queue_number,
      });
    } catch (error) {
      await transaction.rollback();
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
    const itemId = String(req.body.itemId || "").trim();
    const quantity = parseInt(req.body.quantity, 10);
    const paymentMethod = String(req.body.paymentMethod || "").toLowerCase();

    if (!name) {
      return res.status(400).json({ error: "Nama wajib diisi." });
    }

    const item = MENU_ITEMS[itemId];
    if (!item) {
      return res.status(400).json({ error: "Menu tidak ditemukan." });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "Jumlah tidak valid." });
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ error: "Metode pembayaran tidak valid." });
    }

    const status = "confirmed";
    const total = item.price * quantity;

    await poolConnect;
    const result = await pool
      .request()
      .input("name", sql.NVarChar(100), name)
      .input("itemId", sql.NVarChar(50), item.id)
      .input("itemName", sql.NVarChar(100), item.name)
      .input("price", sql.Int, item.price)
      .input("quantity", sql.Int, quantity)
      .input("paymentMethod", sql.NVarChar(10), paymentMethod)
      .input("total", sql.Int, total)
      .input("status", sql.NVarChar(20), status)
      .input("queueNumber", sql.Int, null)
      .input("queueStatus", sql.NVarChar(20), "waiting")
      .input("isPreorder", sql.Bit, 1)
      .query(
        "INSERT INTO orders (name, item_id, item_name, price, quantity, payment_method, total, status, queue_number, queue_status, is_preorder) OUTPUT Inserted.id VALUES (@name, @itemId, @itemName, @price, @quantity, @paymentMethod, @total, @status, @queueNumber, @queueStatus, @isPreorder)"
      );

    return res.json({
      id: result.recordset[0].id,
      total,
      status,
      paymentMethod,
    });
  } catch (error) {
    console.error("Failed to create preorder:", error);
    return res.status(500).json({ error: "Gagal membuat preorder." });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Order ID tidak valid." });
    }

    const order = await getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: "Pesanan tidak ditemukan." });
    }

    return res.json(normalizeOrder(order));
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return res.status(500).json({ error: "Gagal memuat pesanan." });
  }
});

app.get("/api/admin/orders", requireAdminKey, async (req, res) => {
  try {
    const statusFilter = String(req.query.status || "").trim();
    await poolConnect;

    const request = pool.request();
    let query = "SELECT * FROM orders";

    if (statusFilter) {
      request.input("status", sql.NVarChar(20), statusFilter);
      query += " WHERE status = @status";
    }

    query += " ORDER BY created_at DESC";
    const result = await request.query(query);

    return res.json(result.recordset.map(normalizeOrder));
  } catch (error) {
    console.error("Failed to list orders:", error);
    return res.status(500).json({ error: "Gagal memuat daftar pesanan." });
  }
});

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
      await pool
        .request()
        .input("status", sql.NVarChar(20), "paid")
        .input("id", sql.Int, id)
        .query("UPDATE orders SET status = @status WHERE id = @id");
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
        await pool
          .request()
          .input("queueStatus", sql.NVarChar(20), "served")
          .input("id", sql.Int, id)
          .query("UPDATE orders SET queue_status = @queueStatus WHERE id = @id");
      }

      return res.json({ queueStatus: "served" });
    } catch (error) {
      console.error("Failed to mark served:", error);
      return res.status(500).json({ error: "Gagal menandai antrian." });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
