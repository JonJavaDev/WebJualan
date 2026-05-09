(() => {
  const {
    getMenuItem,
    formatRupiah,
    apiFetch,
    queryParam,
    navigateWithTransition,
  } = window.APP;
  const itemId = queryParam("itemId");
  const item = getMenuItem(itemId);

  const summary = document.getElementById("selectedItem");
  const form = document.getElementById("orderForm");
  const message = document.getElementById("formMessage");
  const submitButton = document.getElementById("submitOrder");
  const quantityInput = document.getElementById("quantity");
  const nameInput = document.getElementById("customerName");
  const totalPrice = document.getElementById("totalPrice");

  const setMessage = (text, type = "") => {
    message.textContent = text || "";
    message.className = `form-message ${type}`.trim();
  };

  if (!item) {
    summary.innerHTML =
      "<h3>Menu belum dipilih</h3><p>Silakan kembali ke menu dan pilih paket.</p>";
    submitButton.disabled = true;
    return;
  }

  summary.innerHTML = `
    <h3>${item.name}</h3>
    <p>${item.desc}</p>
    <strong>${formatRupiah(item.price)}</strong>
  `;

  const updateTotal = () => {
    const qty = Math.max(1, parseInt(quantityInput.value, 10) || 1);
    quantityInput.value = qty;
    totalPrice.textContent = formatRupiah(item.price * qty);
  };

  quantityInput.addEventListener("input", updateTotal);
  updateTotal();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("");

    const name = nameInput.value.trim();
    const qty = Math.max(1, parseInt(quantityInput.value, 10) || 1);
    const method = form.querySelector(
      'input[name="paymentMethod"]:checked'
    ).value;

    if (!name) {
      setMessage("Nama wajib diisi.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";

    try {
      const data = await apiFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          name,
          itemId: item.id,
          quantity: qty,
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
