(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queueStatusLabel,
    queryParam,
    navigateWithTransition,
    isAccessBlocked,
    formatItemsHtml,
    sumItemQty,
    generateQrDataUrl,
    setProgressState,
  } = window.APP;
  const orderId = queryParam("orderId");

  if (isAccessBlocked && isAccessBlocked()) {
    return;
  }

  const orderSequence = document.getElementById("orderSequence");
  const orderStatus = document.getElementById("orderStatus");
  const orderQr = document.getElementById("orderQr");
  const details = document.getElementById("queueDetails");
  const message = document.getElementById("queueMessage");
  const payButton = document.getElementById("toPaymentBtn");
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
      progressText.textContent = queueStatusLabel(order.queueStatus || "waiting");
    }
  };

  const render = (order) => {
    const queueStatusText = queueStatusLabel(order.queueStatus || "waiting");
    const paymentStatusText = statusLabel(order.status);
    const itemsHtml = formatItemsHtml(order.items || []);
    const totalItems = sumItemQty(order.items, order.quantity);

    if (orderSequence) {
      orderSequence.textContent = order.sequenceNumber
        ? `#${order.sequenceNumber}`
        : "-";
    }
    if (orderStatus) {
      orderStatus.textContent = `Status pesanan: ${queueStatusText}`;
    }
    if (orderQr) {
      generateQrDataUrl(order.id)
        .then((dataUrl) => {
          if (dataUrl) {
            orderQr.src = dataUrl;
          }
        })
        .catch(() => {
          orderQr.removeAttribute("src");
        });
    }

    const targetUrl =
      order.paymentMethod === "qris"
        ? `Qris_Payment_Page.html?orderId=${order.id}`
        : `Payment_Page.html?orderId=${order.id}`;
    payButton.dataset.target = targetUrl;
    payButton.textContent =
      order.paymentMethod === "qris" ? "Lihat QRIS" : "Lanjut ke pembayaran";
    payButton.disabled = false;

    details.innerHTML = `
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
        <p class="label">Metode</p>
        <p class="value">${order.paymentMethod === "qris" ? "QRIS" : "Tunai"}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status pembayaran</p>
        <p class="value">${paymentStatusText}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status pesanan</p>
        <p class="value">${queueStatusText}</p>
      </div>
      <div class="summary-card">
        <p class="label">Total</p>
        <p class="value">${formatRupiah(order.total)}</p>
      </div>
    `;

    updateProgress(order);
  };

  const loadOrder = async () => {
    try {
      const data = await apiFetch(`/orders/${orderId}`);
      render(data);
    } catch (error) {
      setMessage(error.message || "Gagal memuat antrian.", "error");
      payButton.disabled = true;
    }
  };

  payButton.addEventListener("click", () => {
    if (!orderId) {
      return;
    }
    const targetUrl = payButton.dataset.target || "";
    if (!targetUrl) {
      return;
    }
    if (navigateWithTransition) {
      navigateWithTransition(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  });

  // Update dashboard statistics
  const updateDashboardStats = async () => {
    return;
  };

  if (!orderId) {
    setMessage("Order ID tidak ditemukan.", "error");
    payButton.disabled = true;
    // Still show dashboard even without order ID
    updateDashboardStats();
    window.setInterval(updateDashboardStats, 4000);
    return;
  }

  loadOrder();
  window.setInterval(() => {
    loadOrder();
    updateDashboardStats();
  }, 8000);
  
  // Initial dashboard update
  updateDashboardStats();
})();
