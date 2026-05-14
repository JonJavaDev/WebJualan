(() => {
  const {
    MENU_ITEMS,
    formatRupiah,
    apiFetch,
    queryParam,
    navigateWithTransition,
    isAccessBlocked,
  } = window.APP;

  if (isAccessBlocked && isAccessBlocked()) {
    return;
  }

  const form = document.getElementById("orderForm");
  const message = document.getElementById("formMessage");
  const submitButton = document.getElementById("submitOrder");
  const nameInput = document.getElementById("customerName");
  const phoneInput = document.getElementById("customerPhone");
  const classInput = document.getElementById("customerClass");
  const cartList = document.getElementById("orderCart");
  const totalPrice = document.getElementById("orderTotal");
  const menuPicker = document.getElementById("orderMenuPicker");

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
    const method = form.querySelector(
      'input[name="paymentMethod"]:checked'
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

    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";

    try {
      const data = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          className,
          items,
          paymentMethod: method,
        }),
      });

      const targetUrl = `Queue_Page.html?orderId=${data.id}`;
      if (navigateWithTransition) {
        navigateWithTransition(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    } catch (error) {
      setMessage(error.message || "Gagal membuat pesanan.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Buat pesanan";
    }
  });
})();
