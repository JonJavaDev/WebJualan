(() => {
  const { apiFetch, formatRupiah, statusLabel, queueStatusLabel } = window.APP;

  const adminKeyInput = document.getElementById("adminKey");
  const saveKeyBtn = document.getElementById("saveKeyBtn");
  const clearKeyBtn = document.getElementById("clearKeyBtn");
  const refreshBtn = document.getElementById("refreshOrdersBtn");
  const message = document.getElementById("adminMessage");
  const orderList = document.getElementById("orderList");

  let adminKey = window.localStorage.getItem("adminKey") || "";
  adminKeyInput.value = adminKey;

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const getHeaders = () => {
    return adminKey ? { "x-admin-key": adminKey } : {};
  };

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleString("id-ID");
  };

  const renderOrders = (orders) => {
    if (!orders.length) {
      orderList.innerHTML =
        '<div class="order-card"><p class="muted">Belum ada pesanan.</p></div>';
      return;
    }

    orderList.innerHTML = orders
      .map((order) => {
        const methodLabel = order.paymentMethod === "qris" ? "QRIS" : "Tunai";
        const statusClass =
          order.status === "paid" ? "status-paid" : "status-pending";
        const queueInfo = order.isPreorder
          ? "Preorder (tanpa antrian)"
          : order.queueNumber
            ? `Antrian #${order.queueNumber}`
            : "Antrian belum ada";
        const queueStatusText = order.isPreorder
          ? "Preorder"
          : queueStatusLabel(order.queueStatus || "waiting");
        const paymentAction =
          order.status === "paid"
            ? '<span class="panel-status">Sudah lunas</span>'
            : `<button class="btn btn-small" type="button" data-action="mark-paid" data-id="${order.id}">Konfirmasi ${methodLabel}</button>`;
        const queueAction =
          order.queueStatus !== "served"
            ? `<button class="btn btn-ghost btn-small" type="button" data-action="mark-served" data-id="${order.id}">Konfirmasi selesai</button>`
            : `<span class="panel-status">${queueStatusText}</span>`;

        return `
          <article class="order-card">
            <div class="order-meta">
              <div>
                <h3>#${order.id} - ${order.itemName}</h3>
                <p class="muted">Nama: ${order.name}</p>
              </div>
              <span class="status-badge ${statusClass}">${statusLabel(
          order.status
        )}</span>
            </div>
            <div class="order-info">
              <div>Jumlah: ${order.quantity}</div>
              <div>Metode: ${methodLabel}</div>
              <div>${queueInfo}</div>
              <div>Status pesanan: ${queueStatusText}</div>
              <div>Total: ${formatRupiah(order.total)}</div>
              <div>Waktu: ${formatDate(order.createdAt)}</div>
            </div>
            <div class="order-actions">
              ${paymentAction}
              ${queueAction}
            </div>
          </article>
        `;
      })
      .join("");
  };

  const loadOrders = async (isManual = false) => {
    if (!adminKey) {
      orderList.innerHTML =
        '<div class="order-card"><p class="muted">Masukkan admin key untuk melihat pesanan.</p></div>';
      setMessage("Admin key belum diisi.", "error");
      return;
    }

    try {
      const data = await apiFetch("/admin/orders", {
        headers: getHeaders(),
      });
      renderOrders(data);
      if (isManual) {
        setMessage("Daftar pesanan diperbarui.", "success");
      }
    } catch (error) {
      setMessage(error.message || "Gagal memuat pesanan.", "error");
    }
  };

  const markPaid = async (id) => {
    try {
      await apiFetch(`/admin/orders/${id}/mark-paid`, {
        method: "POST",
        headers: getHeaders(),
      });
      setMessage("Pesanan dikonfirmasi lunas.", "success");
      await loadOrders(false);
    } catch (error) {
      setMessage(error.message || "Gagal konfirmasi pesanan.", "error");
    }
  };

  const markServed = async (id) => {
    try {
      await apiFetch(`/admin/orders/${id}/mark-served`, {
        method: "POST",
        headers: getHeaders(),
      });
      setMessage("Antrian ditandai sudah dilayani.", "success");
      await loadOrders(false);
    } catch (error) {
      setMessage(error.message || "Gagal menandai antrian.", "error");
    }
  };

  saveKeyBtn.addEventListener("click", () => {
    const value = adminKeyInput.value.trim();
    if (!value) {
      setMessage("Admin key wajib diisi.", "error");
      return;
    }
    adminKey = value;
    window.localStorage.setItem("adminKey", adminKey);
    setMessage("Admin key disimpan.", "success");
    loadOrders(true);
  });

  clearKeyBtn.addEventListener("click", () => {
    adminKey = "";
    adminKeyInput.value = "";
    window.localStorage.removeItem("adminKey");
    setMessage("Admin key dihapus.");
    orderList.innerHTML =
      '<div class="order-card"><p class="muted">Masukkan admin key untuk melihat pesanan.</p></div>';
  });

  refreshBtn.addEventListener("click", () => {
    loadOrders(true);
  });

  orderList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const id = parseInt(button.dataset.id, 10);
    if (!Number.isInteger(id)) {
      return;
    }

    if (action === "mark-paid") {
      markPaid(id);
    }

    if (action === "mark-served") {
      markServed(id);
    }
  });

  loadOrders(false);
  window.setInterval(() => loadOrders(false), 8000);
})();
