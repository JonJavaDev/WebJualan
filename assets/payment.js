(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queueStatusLabel,
    queryParam,
    isAccessBlocked,
    formatItemsHtml,
    sumItemQty,
    setProgressState,
  } = window.APP;
  const orderId = queryParam("orderId");

  if (isAccessBlocked && isAccessBlocked()) {
    return;
  }

  const summary = document.getElementById("orderSummary");
  const message = document.getElementById("paymentMessage");
  const qrisPanel = document.getElementById("qrisPanel");
  const cashPanel = document.getElementById("cashPanel");
  const qrisStatus = document.getElementById("qrisStatus");
  const cashStatus = document.getElementById("cashStatus");
  const refreshButton = document.getElementById("refreshStatusBtn");
  const progressCard = document.getElementById("orderProgress");
  const progressText = progressCard?.querySelector(".progress-text");

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const getProgressStep = (order) => {
    if (order.status === "canceled") {
      return 1;
    }
    if (order.status === "pending_qris" || order.status === "pending_cash" || order.status === "pending") {
      return 2;
    }
    if (order.status === "paid") {
      return 3;
    }
    if (order.status === "confirmed") {
      return 4;
    }
    if (order.status === "completed" || order.queueStatus === "served") {
      return 5;
    }
    return 2;
  };

  const updateProgress = (order) => {
    if (!progressCard) {
      return;
    }
    setProgressState(progressCard, getProgressStep(order));
    if (progressText) {
      progressText.textContent = statusLabel(order.status);
    }
  };

  if (!orderId) {
    summary.innerHTML =
      "<p class=\"form-message error\">Order ID tidak ditemukan.</p>";
    return;
  }

  const renderSummary = (order) => {
    const statusClass = order.status === "paid" ? "status-paid" : "status-pending";
    const queueStatusText = queueStatusLabel(order.queueStatus || "waiting");
    const itemsHtml = formatItemsHtml(order.items || []);
    const totalItems = sumItemQty(order.items, order.quantity);
    summary.innerHTML = `
      <div class="summary-card">
        <p class="label">Nama</p>
        <p class="value">${order.name}</p>
      </div>
      <div class="summary-card">
        <p class="label">Nomor telepon</p>
        <p class="value">${order.phone || "-"}</p>
      </div>
      <div class="summary-card">
        <p class="label">Kelas</p>
        <p class="value">${order.className || "-"}</p>
      </div>
      <div class="summary-card full">
        <p class="label">Daftar item</p>
        ${itemsHtml}
      </div>
      <div class="summary-card">
        <p class="label">Total item</p>
        <p class="value">${totalItems}</p>
      </div>
      <div class="summary-card">
        <p class="label">Total</p>
        <p class="value">${formatRupiah(order.total)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Metode</p>
        <p class="value">${order.paymentMethod === "qris" ? "QRIS" : "Tunai"}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status</p>
        <span class="status-badge ${statusClass}">${statusLabel(
      order.status
    )}</span>
      </div>
      <div class="summary-card">
        <p class="label">Status pesanan</p>
        <p class="value">${queueStatusText}</p>
      </div>
    `;

    const isQris = order.paymentMethod === "qris";
    const paymentStatus = statusLabel(order.status);

    qrisPanel.classList.toggle("active", isQris);
    cashPanel.classList.toggle("active", !isQris);
    qrisStatus.textContent = isQris ? paymentStatus : "Tidak dipilih";
    cashStatus.textContent = !isQris ? paymentStatus : "Tidak dipilih";
    updateProgress(order);

  };

  const loadOrder = async (isManual = false) => {
    try {
      const data = await apiFetch(`/orders/${orderId}`);
      renderSummary(data);
      const baseMessage =
        data.status === "paid"
          ? "Pembayaran sudah dikonfirmasi kasir."
          : "Menunggu konfirmasi kasir.";
      const finalMessage = isManual
        ? `Status diperbarui. ${baseMessage}`
        : baseMessage;
      setMessage(finalMessage, data.status === "paid" ? "success" : "");
    } catch (error) {
      summary.innerHTML = `<p class="form-message error">${
        error.message || "Gagal memuat data pesanan."
      }</p>`;
    }
  };
  refreshButton.addEventListener("click", () => {
    loadOrder(true);
  });

  loadOrder();
  window.setInterval(() => loadOrder(false), 8000);
})();
