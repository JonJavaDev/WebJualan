(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queueStatusLabel,
    queryParam,
  } = window.APP;
  const orderId = queryParam("orderId");

  const summary = document.getElementById("preorderConfirmSummary");
  const message = document.getElementById("preorderConfirmMessage");

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const render = (order) => {
    const queueStatusText = queueStatusLabel(order.queueStatus || "waiting");
    summary.innerHTML = `
      <div class="summary-card">
        <p class="label">Kode pesanan</p>
        <p class="value">#${order.id}</p>
      </div>
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
        <p class="label">Total</p>
        <p class="value">${formatRupiah(order.total)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status</p>
        <p class="value">${statusLabel(order.status)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status pesanan</p>
        <p class="value">${queueStatusText}</p>
      </div>
    `;
  };

  const loadOrder = async () => {
    if (!orderId) {
      setMessage("Order ID tidak ditemukan.", "error");
      return;
    }

    try {
      const data = await apiFetch(`/orders/${orderId}`);
      render(data);
      const paymentNote =
        data.paymentMethod === "cash"
          ? "Pembayaran tunai saat barang diterima."
          : "Silakan lanjutkan pembayaran QRIS.";
      const statusNote = `Status pesanan: ${queueStatusLabel(
        data.queueStatus || "waiting"
      )}.`;
      setMessage(`Preorder tersimpan. ${paymentNote} ${statusNote}`, "success");
    } catch (error) {
      setMessage(error.message || "Gagal memuat preorder.", "error");
    }
  };

  loadOrder();
})();
