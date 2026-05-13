(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queryParam,
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

  const summary = document.getElementById("preorderConfirmSummary");
  const message = document.getElementById("preorderConfirmMessage");
  const preorderSequence = document.getElementById("preorderConfirmSequence");
  const preorderQr = document.getElementById("preorderConfirmQr");
  const preorderStatus = document.getElementById("preorderConfirmStatus");
  const progressCard = document.getElementById("preorderProgress");
  const progressText = progressCard?.querySelector(".progress-text");

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const getProgressStep = (status) => {
    switch (status) {
      case "confirmed":
        return 3;
      case "completed":
        return 4;
      case "canceled":
        return 2;
      case "pending":
      default:
        return 2;
    }
  };

  const updateProgress = (order) => {
    if (!progressCard) {
      return;
    }
    setProgressState(progressCard, getProgressStep(order.status));
    if (progressText) {
      progressText.textContent = statusLabel(order.status);
    }
  };

  const render = (order) => {
    const itemsHtml = formatItemsHtml(order.items || []);
    const totalItems = sumItemQty(order.items, order.quantity);
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
        <p class="label">Total</p>
        <p class="value">${formatRupiah(order.total)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status</p>
        <p class="value">${statusLabel(order.status)}</p>
      </div>
    `;
  };

  const loadOrder = async () => {
    if (!orderId) {
      setMessage("Order ID tidak ditemukan.", "error");
      return;
    }

    try {
      const data = await apiFetch(`/preorders/${orderId}`);
      render(data);
      updateProgress(data);
      const paymentNote =
        data.paymentMethod === "cash"
          ? "Pembayaran tunai saat barang diterima."
          : "Silakan lanjutkan pembayaran QRIS.";
      const statusNote =
        data.status === "confirmed"
          ? "Preorder sudah terkonfirmasi."
          : data.status === "canceled"
            ? "Preorder dibatalkan karena bukti pembayaran tidak diunggah dalam 10 menit."
            : "Preorder menunggu konfirmasi.";
      setMessage(
        `Preorder tersimpan. ${paymentNote} ${statusNote}`,
        data.status === "confirmed" ? "success" : data.status === "canceled" ? "error" : ""
      );
      if (preorderStatus) {
        preorderStatus.textContent = `Status preorder: ${statusLabel(
          data.status
        )}`;
      }
      if (preorderSequence) {
        preorderSequence.textContent = data.sequenceNumber
          ? `#${data.sequenceNumber}`
          : "-";
      }
      if (preorderQr) {
        generateQrDataUrl(data.id)
          .then((dataUrl) => {
            if (dataUrl) {
              preorderQr.src = dataUrl;
            }
          })
          .catch(() => {
            preorderQr.removeAttribute("src");
          });
      }
    } catch (error) {
      setMessage(error.message || "Gagal memuat preorder.", "error");
    }
  };

  loadOrder();
  if (orderId) {
    window.setInterval(() => loadOrder(), 8000);
  }
})();
