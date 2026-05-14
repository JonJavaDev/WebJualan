(() => {
  const {
    apiFetch,
    formatRupiah,
    statusLabel,
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

  const summary = document.getElementById("qrisSummary");
  const message = document.getElementById("qrisMessage");
  const waLink = document.getElementById("waLink");
  const statusLink = document.getElementById("statusLink");
  const proofInput = document.getElementById("qrisProofInput");
  const proofButton = document.getElementById("qrisProofButton");
  const proofName = document.getElementById("qrisProofName");
  const proofStatus = document.getElementById("qrisProofStatus");
  const progressCard = document.getElementById("preorderProgress");
  const progressText = progressCard?.querySelector(".progress-text");
  const uploadBar = document.getElementById("qrisUploadBar");
  const uploadState = document.getElementById("qrisUploadState");
  const uploadPercent = document.getElementById("qrisUploadPercent");

  const ENABLE_WHATSAPP_PROOF = false;
  const MAX_SOURCE_SIZE = 15 * 1024 * 1024;
  const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

  const rawWaNumber = "085813241941";
  const waNumber = rawWaNumber.replace(/\D/g, "");
  const normalizedWaNumber = waNumber.startsWith("0")
    ? `62${waNumber.slice(1)}`
    : waNumber;

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const setProofName = (text) => {
    if (!proofName) {
      return;
    }
    proofName.textContent = text || "Belum ada file dipilih.";
  };

  const setProofStatus = (text) => {
    if (!proofStatus) {
      return;
    }
    proofStatus.textContent = text || "";
  };

  const setUploadProgress = (percent, text = "") => {
    const normalizedPercent = Math.max(0, Math.min(100, Number(percent) || 0));
    if (uploadBar) {
      uploadBar.style.setProperty("--progress", `${normalizedPercent}%`);
    }
    if (uploadPercent) {
      uploadPercent.textContent = `${Math.round(normalizedPercent)}%`;
    }
    if (uploadState) {
      uploadState.textContent = text || "";
    }
  };

  const getPreorderProgressStep = (status) => {
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

  const updatePreorderProgress = (order) => {
    if (!progressCard) {
      return;
    }
    setProgressState(progressCard, getPreorderProgressStep(order.status));
    if (progressText) {
      progressText.textContent = statusLabel(order.status);
    }
  };

  const loadImage = (file) => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Gagal membaca gambar."));
      };
      image.src = url;
    });
  };

  const canvasToBlob = (canvas, type, quality) => {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  };

  const compressImageFile = async (file) => {
    const image = await loadImage(file);
    const candidates = [1024, 896, 768, 640, 512];
    const qualities = [0.72, 0.62, 0.54, 0.46, 0.4];
    const outputType = "image/webp";

    for (let index = 0; index < candidates.length; index += 1) {
      const maxSide = candidates[index];
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Browser tidak mendukung kompresi gambar.");
      }
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, outputType, quality);
        if (blob && blob.size <= MAX_UPLOAD_SIZE) {
          const baseName = String(file.name || "proof").replace(/\.[^.]+$/, "");
          return new File([blob], `${baseName}.webp`, {
            type: blob.type || outputType,
            lastModified: Date.now(),
          });
        }
      }

      const fallbackBlob = await canvasToBlob(canvas, outputType, qualities[qualities.length - 1]);
      if (fallbackBlob) {
        const baseName = String(file.name || "proof").replace(/\.[^.]+$/, "");
        const compressedFile = new File([fallbackBlob], `${baseName}.webp`, {
          type: fallbackBlob.type || outputType,
          lastModified: Date.now(),
        });
        if (compressedFile.size <= MAX_UPLOAD_SIZE) {
          return compressedFile;
        }
      }
    }

    throw new Error("Gambar masih terlalu besar setelah dikompres.");
  };

  const uploadProofFile = (file) => {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(
        "POST",
        `${window.APP.API_BASE}/preorders/${encodeURIComponent(orderId)}/payment-proof`
      );

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }
        const percent = 20 + (event.loaded / event.total) * 80;
        setUploadProgress(percent, "Mengirim bukti...");
      };

      request.onload = () => {
        let data = {};
        try {
          data = JSON.parse(request.responseText || "{}");
        } catch (error) {
          data = {};
        }

        if (request.status < 200 || request.status >= 300) {
          reject(new Error(data.error || "Gagal mengunggah bukti."));
          return;
        }

        resolve(data);
      };

      request.onerror = () => {
        reject(new Error("Gagal mengunggah bukti."));
      };

      const formData = new FormData();
      formData.append("proof", file, file.name);
      request.send(formData);
    });
  };

  const buildWaLink = (order) => {
    if (!normalizedWaNumber) {
      waLink.href = "#";
      setMessage("Nomor WhatsApp belum diisi.", "error");
      return;
    }

    const queueLabel = order.queueCode
      ? `#${order.queueCode}`
      : "Preorder (tanpa antrian)";
    const text = `Halo, saya sudah bayar pesanan #${order.id} (${order.itemName}).\nAntrian: ${queueLabel}\nTotal: ${formatRupiah(
      order.total
    )}.\nIni bukti transaksi.`;
    waLink.href = `https://wa.me/${normalizedWaNumber}?text=${encodeURIComponent(
      text
    )}`;
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
        <p class="label">Total</p>
        <p class="value">${formatRupiah(order.total)}</p>
      </div>
      <div class="summary-card">
        <p class="label">Status preorder</p>
        <p class="value">${statusLabel(order.status)}</p>
      </div>
    `;
  };

  const updateProofSection = (order) => {
    if (!proofButton || !proofInput) {
      return;
    }
    if (order.status === "canceled") {
      proofButton.disabled = true;
      proofInput.disabled = true;
      setProofStatus(
        "Preorder dibatalkan karena bukti pembayaran tidak diunggah dalam 10 menit."
      );
      return;
    }
    if (order.paymentMethod !== "qris") {
      proofButton.disabled = true;
      setProofStatus("Bukti QRIS tidak diperlukan untuk pesanan ini.");
      return;
    }

    const hasProof = Boolean(order.paymentProofAvailable);
    const uploadedAt = order.paymentProofUploadedAt
      ? new Date(order.paymentProofUploadedAt).toLocaleString("id-ID")
      : "";
    proofButton.textContent = hasProof ? "Ganti bukti" : "Pilih bukti";
    setProofName(order.paymentProofName || "Belum ada file dipilih.");
    setProofStatus(
      hasProof
        ? `Bukti tersimpan${uploadedAt ? ` pada ${uploadedAt}` : ""}.`
        : "Belum ada bukti diunggah."
    );
  };

  const uploadProof = async (file) => {
    if (!file || !orderId) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("File harus berupa gambar.", "error");
      return;
    }

    if (file.size > MAX_SOURCE_SIZE) {
      setMessage("Ukuran file terlalu besar.", "error");
      return;
    }

    proofButton.disabled = true;
    const originalLabel = proofButton.textContent;
    proofButton.textContent = "Mengunggah...";
    setUploadProgress(10, "Mengompres gambar...");

    let uploadSucceeded = false;

    try {
      const compressedFile = await compressImageFile(file);
      setUploadProgress(22, `Terkecil menjadi ${Math.max(1, Math.round(compressedFile.size / 1024))} KB`);

      const data = await uploadProofFile(compressedFile);

      setMessage("Bukti pembayaran tersimpan.", "success");
      setProofName(compressedFile.name);
      setProofStatus(
        data.uploadedAt
          ? `Bukti tersimpan pada ${new Date(data.uploadedAt).toLocaleString(
              "id-ID"
            )}.`
          : "Bukti tersimpan."
      );
      setUploadProgress(100, "Selesai");
      uploadSucceeded = true;
      await loadOrder();
    } catch (error) {
      setMessage(error.message || "Gagal mengunggah bukti.", "error");
      setUploadProgress(0, "");
    } finally {
      proofButton.disabled = false;
      proofButton.textContent = uploadSucceeded
        ? "Ganti bukti"
        : originalLabel || "Pilih bukti";
      if (proofInput) {
        proofInput.value = "";
      }
    }
  };

  const loadOrder = async () => {
    if (!orderId) {
      setMessage("Order ID tidak ditemukan.", "error");
      if (proofButton) {
        proofButton.disabled = true;
      }
      return;
    }

    statusLink.href = `Preorder_Status_Page.html?orderId=${encodeURIComponent(
      orderId
    )}`;

    try {
      const data = await apiFetch(`/preorders/${encodeURIComponent(orderId)}`);
      updatePreorderProgress(data);
      if (data.paymentMethod !== "qris") {
        setMessage("Pesanan ini bukan QRIS.", "error");
      } else {
        let note = "Silakan bayar QRIS lalu unggah bukti pembayaran.";
        let type = "";
        if (data.status === "confirmed") {
          note = "Pesanan sukses. Pembayaran sudah terkonfirmasi.";
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
      }
      render(data);
      updateProofSection(data);
      if (ENABLE_WHATSAPP_PROOF) {
        buildWaLink(data);
      } else if (waLink) {
        waLink.classList.add("disabled");
        waLink.setAttribute("aria-disabled", "true");
        waLink.href = "#";
      }
    } catch (error) {
      setMessage(error.message || "Gagal memuat pesanan.", "error");
    }
  };

  if (proofButton && proofInput) {
    proofButton.addEventListener("click", () => {
      proofInput.click();
    });

    proofInput.addEventListener("change", () => {
      const file = proofInput.files && proofInput.files[0];
      if (file) {
        uploadProof(file);
      }
    });
  }

  loadOrder();
  if (orderId) {
    window.setInterval(() => loadOrder(), 8000);
  }
})();
