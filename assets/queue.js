(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queueStatusLabel,
    queryParam,
    navigateWithTransition,
  } = window.APP;
  const orderId = queryParam("orderId");

  const ticketNumber = document.getElementById("ticketNumber");
  const ticketStatus = document.getElementById("ticketStatus");
  const details = document.getElementById("queueDetails");
  const message = document.getElementById("queueMessage");
  const payButton = document.getElementById("toPaymentBtn");

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const render = (order) => {
    const isPreorder = order.isPreorder;
    const queueStatusText = queueStatusLabel(order.queueStatus || "waiting");
    const paymentStatusText = statusLabel(order.status);

    ticketNumber.textContent = isPreorder ? "-" : order.queueNumber || "-";
    ticketStatus.textContent = isPreorder
      ? "Preorder tidak memakai nomor antrian."
      : `Status pesanan: ${queueStatusText}`;

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
        <p class="label">Menu</p>
        <p class="value">${order.itemName}</p>
      </div>
      <div class="summary-card">
        <p class="label">Jumlah</p>
        <p class="value">${order.quantity}</p>
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

  if (!orderId) {
    setMessage("Order ID tidak ditemukan.", "error");
    payButton.disabled = true;
    return;
  }

  loadOrder();
  window.setInterval(() => loadOrder(), 8000);
})();
