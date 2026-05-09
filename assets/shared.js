(() => {
  const MENU_ITEMS = [
    {
      id: "hemat",
      name: "Paket Hemat",
      price: 13000,
      desc: "Mie Chili Oil + free es Teh",
    },
    {
      id: "regular",
      name: "Paket Regular",
      price: 15000,
      desc: "Mie Chili + Pangsit + Es Teh",
    },
    {
      id: "sultan",
      name: "Paket Sultan",
      price: 20000,
      desc: "Mie Chili + Pangmi + Pangsit + Es Teh",
    },
  ];

  const API_BASE = window.API_BASE || "http://localhost:3000/api";

  const formatRupiah = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return "-";
    }
    return `Rp ${new Intl.NumberFormat("id-ID").format(amount)}`;
  };

  const statusLabel = (status) => {
    switch (status) {
      case "paid":
        return "Lunas";
      case "confirmed":
        return "Terkonfirmasi";
      case "pending_qris":
        return "Menunggu QRIS";
      case "pending_cash":
        return "Menunggu Tunai";
      default:
        return status ? status.replace("_", " ") : "-";
    }
  };

  const queueStatusLabel = (status) => {
    switch (status) {
      case "waiting":
        return "Menunggu panggilan";
      case "served":
        return "Selesai";
      case "preorder":
        return "Preorder";
      default:
        return status ? status.replace("_", " ") : "-";
    }
  };

  const queryParam = (name) => {
    return new URLSearchParams(window.location.search).get(name);
  };

  const apiFetch = async (path, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  };

  const getMenuItem = (id) => {
    return MENU_ITEMS.find((item) => item.id === id);
  };

  const navigateWithTransition = (url) => {
    if (!url) {
      return;
    }

    if (document.body.classList.contains("page-leave")) {
      return;
    }

    document.body.classList.remove("page-enter");
    document.body.classList.add("page-leave");

    window.setTimeout(() => {
      window.location.href = url;
    }, 320);
  };

  const enablePageTransitions = () => {
    if (document.querySelector(".page-overlay")) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "page-overlay";
    document.body.appendChild(overlay);

    window.requestAnimationFrame(() => {
      document.body.classList.add("page-enter");
    });

    document.addEventListener("click", (event) => {
      const anchor = event.target.closest("a");
      if (!anchor) {
        return;
      }

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch (error) {
        return;
      }

      if (!["http:", "https:", "file:"].includes(url.protocol)) {
        return;
      }

      event.preventDefault();
      navigateWithTransition(url.href);
    });
  };

  window.APP = {
    MENU_ITEMS,
    API_BASE,
    formatRupiah,
    statusLabel,
    queueStatusLabel,
    queryParam,
    apiFetch,
    getMenuItem,
    navigateWithTransition,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enablePageTransitions);
  } else {
    enablePageTransitions();
  }
})();
