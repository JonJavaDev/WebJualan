(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queueStatusLabel,
    isAccessBlocked,
  } = window.APP;

  if (isAccessBlocked && isAccessBlocked()) {
    return;
  }

  const adminKeyInput = document.getElementById("adminKey");
  const saveKeyBtn = document.getElementById("saveKeyBtn");
  const clearKeyBtn = document.getElementById("clearKeyBtn");
  const refreshBtn = document.getElementById("refreshOrdersBtn");
  const message = document.getElementById("adminMessage");
  const orderList = document.getElementById("orderList");
  const preorderList = document.getElementById("preorderList");
  const ordersSection = document.getElementById("ordersSection");
  const preordersSection = document.getElementById("preordersSection");
  const viewButtons = document.querySelectorAll(".view-toggle button[data-view]");
  const proofModal = document.getElementById("proofModal");
  const proofCloseBtn = document.getElementById("proofCloseBtn");
  const proofImage = document.getElementById("proofImage");
  const proofCaption = document.getElementById("proofCaption");
  const VIEW_STORAGE_KEY = "cashierView";

  let adminKey = window.localStorage.getItem("adminKey") || "";
  adminKeyInput.value = adminKey;

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const setView = (view) => {
    const isOrders = view === "orders";
    if (ordersSection) {
      ordersSection.classList.toggle("hidden", !isOrders);
    }
    if (preordersSection) {
      preordersSection.classList.toggle("hidden", isOrders);
    }
    viewButtons.forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
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

  const formatItemsLabel = (items, fallbackName, fallbackQty) => {
    if (Array.isArray(items) && items.length) {
      return items
        .map((item) => `${item.name} x${item.quantity}`)
        .join(", ");
    }
    if (fallbackName) {
      const qty = Number.isFinite(fallbackQty) ? fallbackQty : 1;
      return `${fallbackName} x${qty}`;
    }
    return "-";
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
          : order.queueCode
            ? `Kode antrian: ${order.queueCode}`
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
                <h3>#${order.publicId} - ${order.itemName}</h3>
                <p class="muted">Nama: ${order.name}</p>
              </div>
              <span class="status-badge ${statusClass}">${statusLabel(
          order.status
        )}</span>
            </div>
            <div class="order-info">
              <div>Kode pesanan: ${order.publicId || "-"}</div>
              <div>Kode urut: ${order.sequenceNumber || "-"}</div>
              <div>Jumlah: ${order.quantity}</div>
              <div>Metode: ${methodLabel}</div>
              <div>Telepon: ${order.phone || "-"}</div>
              <div>Kelas: ${order.className || "-"}</div>
              <div>Item: ${formatItemsLabel(order.items, order.itemName, order.quantity)}</div>
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

  const renderPreorders = (preorders) => {
    if (!preorders.length) {
      preorderList.innerHTML =
        '<div class="order-card"><p class="muted">Belum ada preorder.</p></div>';
      return;
    }

    preorderList.innerHTML = preorders
      .map((preorder) => {
        const methodLabel = preorder.paymentMethod === "qris" ? "QRIS" : "Tunai";
        const statusClass =
          preorder.status === "pending" ? "status-pending" : "status-paid";
        const statusText = statusLabel(preorder.status);
        const levelText = Number.isFinite(preorder.level) ? preorder.level : "-";
        const noteText = preorder.note ? preorder.note : "-";
        let confirmAction = `<span class="panel-status">${statusText}</span>`;
        if (preorder.status === "pending") {
          confirmAction = `<button class="btn btn-small" type="button" data-action="mark-preorder-confirmed" data-id="${preorder.id}">Konfirmasi preorder</button>`;
        }
        if (preorder.status === "confirmed") {
          confirmAction = `<button class="btn btn-ghost btn-small" type="button" data-action="mark-preorder-completed" data-id="${preorder.id}">Konfirmasi selesai</button>`;
        }

        const proofAction =
          preorder.paymentMethod === "qris"
            ? preorder.paymentProofAvailable
              ? `<button class="btn btn-ghost btn-small" type="button" data-action="view-proof" data-id="${preorder.id}">Tampilkan bukti</button>`
              : `<span class="panel-status">Bukti belum dikirim</span>`
            : "";

        return `
          <article class="order-card">
            <div class="order-meta">
              <div>
                <h3>#${preorder.publicId} - ${preorder.itemName}</h3>
                <p class="muted">Nama: ${preorder.name}</p>
              </div>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="order-info">
              <div>Kode pesanan: ${preorder.publicId || "-"}</div>
              <div>Kode urut: ${preorder.sequenceNumber || "-"}</div>
              <div>Jumlah: ${preorder.quantity}</div>
              <div>Metode: ${methodLabel}</div>
              <div>Telepon: ${preorder.phone || "-"}</div>
              <div>Kelas: ${preorder.className || "-"}</div>
              <div>Level: ${levelText}</div>
              <div>Item: ${formatItemsLabel(preorder.items, preorder.itemName, preorder.quantity)}</div>
              <div>Catatan: ${noteText}</div>
              <div>Total: ${formatRupiah(preorder.total)}</div>
              <div>Waktu: ${formatDate(preorder.createdAt)}</div>
            </div>
            <div class="order-actions">
              ${confirmAction}
              ${proofAction}
            </div>
          </article>
        `;
      })
      .join("");
  };

  const openProofModal = (payload) => {
    if (!proofModal || !proofImage) {
      return;
    }
    proofImage.src = `data:${payload.contentType};base64,${payload.data}`;
    if (proofCaption) {
      const uploadedAt = payload.uploadedAt
        ? new Date(payload.uploadedAt).toLocaleString("id-ID")
        : "-";
      proofCaption.textContent = `Bukti QRIS #${payload.publicId} - ${uploadedAt}`;
    }
    proofModal.classList.remove("hidden");
    proofModal.setAttribute("aria-hidden", "false");
  };

  const closeProofModal = () => {
    if (!proofModal || !proofImage) {
      return;
    }
    proofModal.classList.add("hidden");
    proofModal.setAttribute("aria-hidden", "true");
    proofImage.src = "";
  };

  const viewProof = async (id) => {
    if (!adminKey) {
      setMessage("Admin key belum diisi.", "error");
      return;
    }
    try {
      const data = await apiFetch(`/admin/preorders/${id}/payment-proof`, {
        headers: getHeaders(),
      });
      openProofModal(data);
    } catch (error) {
      setMessage(error.message || "Gagal memuat bukti QRIS.", "error");
    }
  };

  const loadOrders = async (isManual = false) => {
    if (!adminKey) {
      orderList.innerHTML =
        '<div class="order-card"><p class="muted">Masukkan admin key untuk melihat pesanan.</p></div>';
      preorderList.innerHTML =
        '<div class="order-card"><p class="muted">Masukkan admin key untuk melihat preorder.</p></div>';
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

  const loadPreorders = async (isManual = false) => {
    if (!adminKey) {
      preorderList.innerHTML =
        '<div class="order-card"><p class="muted">Masukkan admin key untuk melihat preorder.</p></div>';
      if (!isManual) {
        return;
      }
      setMessage("Admin key belum diisi.", "error");
      return;
    }

    try {
      const data = await apiFetch("/admin/preorders", {
        headers: getHeaders(),
      });
      renderPreorders(data);
      if (isManual) {
        setMessage("Daftar preorder diperbarui.", "success");
      }
    } catch (error) {
      setMessage(error.message || "Gagal memuat preorder.", "error");
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

  const markPreorderConfirmed = async (id) => {
    try {
      await apiFetch(`/admin/preorders/${id}/mark-confirmed`, {
        method: "POST",
        headers: getHeaders(),
      });
      setMessage("Preorder dikonfirmasi.", "success");
      await loadPreorders(false);
    } catch (error) {
      setMessage(error.message || "Gagal konfirmasi preorder.", "error");
    }
  };

  const markPreorderCompleted = async (id) => {
    try {
      await apiFetch(`/admin/preorders/${id}/mark-completed`, {
        method: "POST",
        headers: getHeaders(),
      });
      setMessage("Preorder ditandai selesai.", "success");
      await loadPreorders(false);
    } catch (error) {
      setMessage(error.message || "Gagal menandai preorder selesai.", "error");
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
    loadPreorders(true);
  });

  clearKeyBtn.addEventListener("click", () => {
    adminKey = "";
    adminKeyInput.value = "";
    window.localStorage.removeItem("adminKey");
    setMessage("Admin key dihapus.");
    orderList.innerHTML =
      '<div class="order-card"><p class="muted">Masukkan admin key untuk melihat pesanan.</p></div>';
    preorderList.innerHTML =
      '<div class="order-card"><p class="muted">Masukkan admin key untuk melihat preorder.</p></div>';
  });

  refreshBtn.addEventListener("click", () => {
    loadOrders(true);
    loadPreorders(true);
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view || "orders";
      setView(view);
    });
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

  preorderList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const id = parseInt(button.dataset.id, 10);
    if (!Number.isInteger(id)) {
      return;
    }

    if (action === "mark-preorder-confirmed") {
      markPreorderConfirmed(id);
    }

    if (action === "mark-preorder-completed") {
      markPreorderCompleted(id);
    }

    if (action === "view-proof") {
      viewProof(id);
    }
  });

  if (proofCloseBtn) {
    proofCloseBtn.addEventListener("click", () => {
      closeProofModal();
    });
  }

  if (proofModal) {
    proofModal.addEventListener("click", (event) => {
      if (event.target === proofModal) {
        closeProofModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProofModal();
    }
  });

  loadOrders(false);
  loadPreorders(false);
  setView(window.localStorage.getItem(VIEW_STORAGE_KEY) || "orders");
  window.setInterval(() => {
    loadOrders(false);
    loadPreorders(false);
  }, 8000);
})();
