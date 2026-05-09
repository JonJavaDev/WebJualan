(() => {
  const { MENU_ITEMS, formatRupiah, navigateWithTransition } = window.APP;
  const grid = document.getElementById("menuGrid");

  if (!grid) {
    return;
  }

  MENU_ITEMS.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "menu-card reveal";
    card.style.animationDelay = `${index * 0.05}s`;
    card.innerHTML = `
      <div class="menu-top">
        <div>
          <h3>${item.name}</h3>
          <p class="menu-sub">${item.desc}</p>
        </div>
        <span class="pill">${formatRupiah(item.price)}</span>
      </div>
      <a class="btn btn-small" href="Order_Page.html?itemId=${encodeURIComponent(
        item.id
      )}">Pesan sekarang</a>
    `;

    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }
      const targetUrl = `Order_Page.html?itemId=${encodeURIComponent(item.id)}`;
      if (navigateWithTransition) {
        navigateWithTransition(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    });

    grid.appendChild(card);
  });
})();
