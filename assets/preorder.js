(() => {
  const {
    MENU_ITEMS,
    formatRupiah,
    apiFetch,
    queryParam,
    navigateWithTransition,
  } = window.APP;

  const itemSelect = document.getElementById("preorderItem");
  const summary = document.getElementById("preorderSummary");
  const form = document.getElementById("preorderForm");
  const message = document.getElementById("preorderMessage");
  const submitButton = document.getElementById("submitPreorder");
  const quantityInput = document.getElementById("preorderQuantity");
  const nameInput = document.getElementById("preorderName");
  const totalPrice = document.getElementById("preorderTotal");

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  MENU_ITEMS.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name} - ${formatRupiah(item.price)}`;
    itemSelect.appendChild(option);
  });

  const preselect = queryParam("itemId");
  if (preselect && MENU_ITEMS.some((item) => item.id === preselect)) {
    itemSelect.value = preselect;
  }

  const updateSummary = () => {
    const item = MENU_ITEMS.find((data) => data.id === itemSelect.value);
    if (!item) {
      summary.innerHTML = "<p class=\"muted\">Menu belum dipilih.</p>";
      totalPrice.textContent = "Rp 0";
      return;
    }

    summary.innerHTML = `
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <strong>${formatRupiah(item.price)}</strong>
    `;

    const qty = Math.max(1, parseInt(quantityInput.value, 10) || 1);
    quantityInput.value = qty;
    totalPrice.textContent = formatRupiah(item.price * qty);
  };

  itemSelect.addEventListener("change", updateSummary);
  quantityInput.addEventListener("input", updateSummary);
  updateSummary();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("");

    const itemId = itemSelect.value;
    const name = nameInput.value.trim();
    const qty = Math.max(1, parseInt(quantityInput.value, 10) || 1);
    const method = form.querySelector(
      'input[name="preorderPayment"]:checked'
    ).value;

    if (!name) {
      setMessage("Nama wajib diisi.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";

    try {
      const data = await apiFetch("/preorders", {
        method: "POST",
        body: JSON.stringify({
          name,
          itemId,
          quantity: qty,
          paymentMethod: method,
        }),
      });

      const targetUrl =
        method === "qris"
          ? `Qris_Payment_Page.html?orderId=${data.id}`
          : `Preorder_Confirm_Page.html?orderId=${data.id}`;
      if (navigateWithTransition) {
        navigateWithTransition(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    } catch (error) {
      setMessage(error.message || "Gagal membuat preorder.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Konfirmasi preorder";
    }
  });
})();
