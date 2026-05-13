(() => {
  const {
    MENU_ITEMS,
    formatRupiah,
    apiFetch,
    queryParam,
    navigateWithTransition,
  } = window.APP;

  const cartList = document.getElementById("preorderCart");
  const menuPicker = document.getElementById("preorderMenuPicker");
  const form = document.getElementById("preorderForm");
  const message = document.getElementById("preorderMessage");
  const submitButton = document.getElementById("submitPreorder");
  const nameInput = document.getElementById("preorderName");
  const phoneInput = document.getElementById("preorderPhone");
  const classInput = document.getElementById("preorderClass");
  const levelInput = document.getElementById("preorderLevel");
  const noteInput = document.getElementById("preorderNote");
  const totalPrice = document.getElementById("preorderTotal");
  const PREORDER_STORAGE_KEY = "lastPreorderId";

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  const isFullName = (value) => {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return parts.length >= 2;
  };

  const normalizePhone = (value) => {
    return String(value || "").replace(/\D/g, "");
  };

  const isValidPhone = (value) => {
    const digits = normalizePhone(value);
    return digits.length >= 9 && digits.length <= 15;
  };

  const normalizeQty = (value) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  };

  const saveLastPreorderId = (id) => {
    if (!Number.isInteger(id)) {
      return;
    }
    window.localStorage.setItem(PREORDER_STORAGE_KEY, String(id));
  };

  const cartState = new Map();

  const preselect = queryParam("itemId");
  if (preselect && MENU_ITEMS.some((item) => item.id === preselect)) {
    cartState.set(preselect, 1);
  }

  const renderMenuPicker = () => {
    if (!menuPicker) {
      return;
    }
    menuPicker.innerHTML = MENU_ITEMS.map((item) => {
      const qty = cartState.get(item.id) || 0;
      return `
        <article class="menu-picker-item" data-item-id="${item.id}">
          <div class="menu-picker-info">
            <h3>${item.name}</h3>
            <p class="muted">${item.desc}</p>
            <p class="menu-picker-price">${formatRupiah(item.price)}</p>
          </div>
          <div class="quantity-control compact">
            <button
              class="qty-btn"
              type="button"
              data-action="decrease"
              data-item-id="${item.id}"
              aria-label="Kurangi ${item.name}"
            >
              -
            </button>
            <input
              type="number"
              min="0"
              value="${qty}"
              inputmode="numeric"
              data-item-id="${item.id}"
            />
            <button
              class="qty-btn"
              type="button"
              data-action="increase"
              data-item-id="${item.id}"
              aria-label="Tambah ${item.name}"
            >
              +
            </button>
          </div>
        </article>
      `;
    }).join("");
  };

  const buildCartItems = () => {
    return MENU_ITEMS.filter((item) => (cartState.get(item.id) || 0) > 0).map(
      (item) => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: cartState.get(item.id) || 0,
      })
    );
  };

  const updateCart = () => {
    if (!cartList || !totalPrice) {
      return;
    }
    const items = buildCartItems();
    if (!items.length) {
      cartList.innerHTML = "<p class=\"muted\">Keranjang masih kosong.</p>";
      totalPrice.textContent = "Rp 0";
      return;
    }

    cartList.innerHTML = items
      .map((item) => {
        const subtotal = item.price * item.quantity;
        return `
          <div class="cart-item">
            <div class="cart-item-info">
              <p class="cart-item-title">${item.name}</p>
              <div class="cart-item-meta">
                <span>Jumlah</span>
                <strong>${item.quantity}</strong>
              </div>
            </div>
            <div class="cart-item-price">
              <span class="muted">Subtotal</span>
              <strong>${formatRupiah(subtotal)}</strong>
            </div>
          </div>
        `;
      })
      .join("");

    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    totalPrice.textContent = formatRupiah(total);
  };

  const setItemQty = (itemId, qty) => {
    const normalized = normalizeQty(qty);
    if (normalized <= 0) {
      cartState.delete(itemId);
    } else {
      cartState.set(itemId, normalized);
    }
    if (menuPicker) {
      const input = menuPicker.querySelector(
        `input[data-item-id="${itemId}"]`
      );
      if (input) {
        input.value = normalized;
      }
    }
    updateCart();
  };

  if (menuPicker) {
    menuPicker.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }
      const itemId = button.dataset.itemId;
      if (!itemId) {
        return;
      }
      const currentQty = cartState.get(itemId) || 0;
      const delta =
        button.dataset.action === "increase"
          ? 1
          : button.dataset.action === "decrease"
            ? -1
            : 0;
      if (!delta) {
        return;
      }
      setItemQty(itemId, currentQty + delta);
    });

    menuPicker.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-item-id]");
      if (!input) {
        return;
      }
      setItemQty(input.dataset.itemId, input.value);
    });
  }

  renderMenuPicker();
  updateCart();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("");

    const items = buildCartItems().map(({ itemId, quantity }) => ({
      itemId,
      quantity,
    }));
    const name = nameInput.value.trim();
    const phone = normalizePhone(phoneInput.value);
    const className = classInput.value.trim();
    const level = parseInt(levelInput.value, 10);
    const note = String(noteInput.value || "").trim();
    const method = form.querySelector(
      'input[name="preorderPayment"]:checked'
    ).value;

    if (!items.length) {
      setMessage("Keranjang masih kosong.", "error");
      return;
    }

    if (!name) {
      setMessage("Nama wajib diisi.", "error");
      return;
    }

    if (!isFullName(name)) {
      setMessage("Nama harus diisi lengkap (nama depan dan belakang).", "error");
      return;
    }

    if (!phone) {
      setMessage("Nomor telepon wajib diisi.", "error");
      return;
    }

    if (!isValidPhone(phone)) {
      setMessage("Nomor telepon tidak valid.", "error");
      return;
    }

    if (!className) {
      setMessage("Kelas wajib dipilih.", "error");
      return;
    }

    if (!Number.isInteger(level) || level < 0 || level > 5) {
      setMessage("Level wajib dipilih (0-5).", "error");
      return;
    }

    if (note.length > 255) {
      setMessage("Catatan maksimal 255 karakter.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";

    try {
      const data = await apiFetch("/preorders", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          className,
          level,
          note: note || null,
          items,
          paymentMethod: method,
        }),
      });

      saveLastPreorderId(data.id);

      const targetUrl =
        method === "qris"
          ? `Qris_Payment_Page.html?orderId=${data.id}`
          : `Preorder_Status_Page.html?orderId=${data.id}`;
      if (navigateWithTransition) {
        navigateWithTransition(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    } catch (error) {
      if (error.details && error.details.existingId) {
        const targetUrl = `Preorder_Status_Page.html?orderId=${error.details.existingId}`;
        saveLastPreorderId(error.details.existingId);
        window.alert(
          error.message ||
            "Kamu masih punya preorder aktif. Silakan cek status preorder dulu."
        );
        if (navigateWithTransition) {
          navigateWithTransition(targetUrl);
        } else {
          window.location.href = targetUrl;
        }
        return;
      }
      setMessage(error.message || "Gagal membuat preorder.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Konfirmasi preorder";
    }
  });
})();
