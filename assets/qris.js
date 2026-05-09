(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queueStatusLabel,
    queryParam,
  } = window.APP;
  const orderId = queryParam("orderId");

  const summary = document.getElementById("qrisSummary");
  const message = document.getElementById("qrisMessage");
  const waLink = document.getElementById("waLink");
  const statusLink = document.getElementById("statusLink");

  const waNumber = String(window.WA_NUMBER || "").replace(/\D/g, "");

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const buildWaLink = (order) => {
    if (!waNumber) {
      waLink.href = "#";
      setMessage("Nomor WhatsApp belum diisi.", "error");
      return;
    }

    const text = `Halo, saya sudah bayar pesanan #${order.id} (${order.itemName}) total ${formatRupiah(
      order.total
    )}. Ini bukti transaksi.`;
    waLink.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
  };

  const render = (order) => {
    const queueStatusText = queueStatusLabel(order.queueStatus || "waiting");
    const queueCard = order.queueNumber
      ? `
      <div class="summary-card">
        <p class="label">Antrian</p>
        <p class="value">#${order.queueNumber}</p>
      </div>
      `
      : "";
    summary.innerHTML = `
      <div class="summary-card">
        <p class="label">Kode pesanan</p>
        <p class="value">#${order.id}</p>
      </div>
      ${queueCard}
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
        <p class="label">Total</p>
        <p class="value">${formatRupiah(order.total)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status pembayaran</p>
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

    statusLink.href = `Payment_Page.html?orderId=${orderId}`;

    try {
      const data = await apiFetch(`/orders/${orderId}`);
      if (data.paymentMethod !== "qris") {
        setMessage("Pesanan ini bukan QRIS.", "error");
      }
      render(data);
      buildWaLink(data);
    } catch (error) {
      setMessage(error.message || "Gagal memuat pesanan.", "error");
    }
  };

  loadOrder();
})();
