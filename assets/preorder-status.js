(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
    queryParam,
    navigateWithTransition,
    isAccessBlocked,
    formatItemsHtml,
    sumItemQty,
    generateQrDataUrl,
    setProgressState,
  } = window.APP;

  const summary = document.getElementById("preorderStatusSummary");
  const message = document.getElementById("preorderStatusMessage");
  const form = document.getElementById("preorderLookupForm");
  const input = document.getElementById("preorderIdInput");
  const qrisPanel = document.getElementById("preorderQrisPanel");
  const actions = document.getElementById("preorderActions");
  const preorderSequence = document.getElementById("preorderSequence");
  const preorderQr = document.getElementById("preorderQr");
  const preorderStatusNote = document.getElementById("preorderStatusNote");
  const progressCard = document.getElementById("preorderProgress");
  const progressText = progressCard?.querySelector(".progress-text");
  const PREORDER_STORAGE_KEY = "lastPreorderId";

  if (isAccessBlocked && isAccessBlocked()) {
    return;
  }

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

  const updateProgress = (preorder) => {
    if (!progressCard) {
      return;
    }
    setProgressState(progressCard, getProgressStep(preorder.status));
    if (progressText) {
      progressText.textContent = statusLabel(preorder.status);
    }
  };

  const render = (preorder) => {
    const itemsHtml = formatItemsHtml(preorder.items || []);
    const totalItems = sumItemQty(preorder.items, preorder.quantity);
    summary.innerHTML = `
      <div class="summary-card">
        <p class="label">Kode preorder</p>
        <p class="value">#${preorder.id}</p>
      </div>
      <div class="summary-card">
        <p class="label">Nama</p>
        <p class="value">${preorder.name}</p>
      </div>
      <div class="summary-card">
        <p class="label">Nomor telepon</p>
        <p class="value">${preorder.phone || "-"}</p>
      </div>
      <div class="summary-card">
        <p class="label">Kelas</p>
        <p class="value">${preorder.className || "-"}</p>
      </div>
      <div class="summary-card">
        <p class="label">Level</p>
        <p class="value">${preorder.level ?? "-"}</p>
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
        <p class="value">${preorder.paymentMethod === "qris" ? "QRIS" : "Tunai"}</p>
      </div>
      <div class="summary-card">
        <p class="label">Total</p>
        <p class="value">${formatRupiah(preorder.total)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status preorder</p>
        <p class="value">${statusLabel(preorder.status)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Catatan</p>
        <p class="value">${preorder.note || "-"}</p>
      </div>
    `;
  };

  const updateQrisPanel = (preorder) => {
    if (!qrisPanel) {
      return;
    }
    const show =
      preorder.paymentMethod === "qris" && preorder.status === "pending";
    qrisPanel.classList.toggle("hidden", !show);
  };

  const updateActions = (preorder) => {
    if (!actions) {
      return;
    }
    const canOrderAgain =
      preorder.status === "confirmed" ||
      preorder.status === "completed" ||
      preorder.status === "canceled";
    actions.classList.toggle("hidden", !canOrderAgain);
  };

  const loadPreorder = async (id) => {
    if (!id) {
      summary.innerHTML = "";
      setMessage("Masukkan kode preorder untuk melihat status.", "error");
      return;
    }

    try {
      const data = await apiFetch(`/preorders/${encodeURIComponent(id)}`);
      window.localStorage.setItem(PREORDER_STORAGE_KEY, String(data.id));
      if (input && !input.value) {
        input.value = String(data.id);
      }
      render(data);
      updateProgress(data);
      updateQrisPanel(data);
      updateActions(data);
      let note = "Preorder kamu masih menunggu konfirmasi.";
      let type = "";
      if (data.status === "confirmed") {
        note = "Pesanan sukses. Preorder sudah terkonfirmasi.";
        type = "success";
      }
      if (data.status === "completed") {
        note = "Pesanan sudah diambil. Terima kasih.";
        type = "success";
      }
      if (data.status === "canceled") {
        note =
          "Preorder dibatalkan karena bukti pembayaran tidak diunggah dalam 10 menit.";
        type = "error";
      }
      setMessage(note, type);
      if (preorderStatusNote) {
        preorderStatusNote.textContent = `Status preorder: ${statusLabel(
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
      summary.innerHTML = "";
      if (qrisPanel) {
        qrisPanel.classList.add("hidden");
      }
      if (actions) {
        actions.classList.add("hidden");
      }
      setMessage(error.message || "Gagal memuat preorder.", "error");
    }
  };

  const resolveOrderId = () => {
    return (
      queryParam("orderId") || window.localStorage.getItem(PREORDER_STORAGE_KEY)
    );
  };

  if (form && input) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = String(input.value || "").trim();
      if (!id) {
        setMessage("Kode preorder wajib diisi.", "error");
        return;
      }
      const targetUrl = `Preorder_Status_Page.html?orderId=${encodeURIComponent(
        id
      )}`;
      if (navigateWithTransition) {
        navigateWithTransition(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    });
  }

  const initialId = resolveOrderId();
  loadPreorder(initialId);
  if (initialId) {
    window.setInterval(() => loadPreorder(resolveOrderId()), 8000);
  }
})();
