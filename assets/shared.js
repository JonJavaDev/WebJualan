(() => {
  const MENU_ITEMS = [
    {
      id: "hemat",
      name: "Paket Hemat",
      price: 13000,
      desc: "Mie Chili Oil + Es Teh",
    },
    {
      id: "regular",
      name: "Paket Regular",
      price: 15000,
      desc: "Mie Chili + Pangsit + free es Teh",
    },
    {
      id: "sultan",
      name: "Paket Sultan",
      price: 20000,
      desc: "Mie Chili + Pangmi + Pangsit + free es Teh",
    },
  ];

  const resolveApiBase = () => {
    if (window.API_BASE) {
      return window.API_BASE;
    }
    if (window.location.protocol === "file:") {
      return "http://localhost:3001/api";
    }
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        if (window.location.port !== "3000") {
          return "http://localhost:3001/api";
        }
      }
      return `${window.location.origin}/api`;
  };

  const API_BASE = resolveApiBase();

  const PREORDER_ONLY_START = { month: 4, day: 10 };
  const PREORDER_ONLY_END = { month: 4, day: 21 };
  const PREORDER_ONLY_ENABLED = String(window.PREORDER_ONLY_ENABLED || "false") === "true";
  const PREORDER_ONLY_MESSAGE =
    "Order langsung belum tersedia pada periode 10-21 Mei. Silakan gunakan preorder.";
  const PREORDER_ONLY_PAGES = new Set([
    "Main_Page.html",
    "Preorder_Page.html",
    "Preorder_Confirm_Page.html",
    "Preorder_Status_Page.html",
    "Qris_Payment_Page.html",
    "Cashier_Page.html",
  ]);

  const getCurrentPage = () => {
    const path = window.location.pathname || "";
    const file = path.split("/").pop();
    return file || "Main_Page.html";
  };

  const isWithinPreorderWindow = (date = new Date()) => {
    const year = date.getFullYear();
    const start = new Date(year, PREORDER_ONLY_START.month, PREORDER_ONLY_START.day, 0, 0, 0, 0);
    const end = new Date(year, PREORDER_ONLY_END.month, PREORDER_ONLY_END.day, 23, 59, 59, 999);
    return date >= start && date <= end;
  };

  let accessBlocked = false;

  const formatRupiah = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return "-";
    }
    return `Rp ${new Intl.NumberFormat("id-ID").format(amount)}`;
  };

  const statusLabel = (status) => {
    switch (status) {
      case "canceled":
        return "Dibatalkan";
      case "paid":
        return "Lunas";
      case "confirmed":
        return "Terkonfirmasi";
      case "completed":
        return "Sudah diambil";
      case "pending":
        return "Menunggu konfirmasi";
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
      const error = new Error(data.error || "Request failed");
      error.details = data;
      throw error;
    }

    return data;
  };

  const getMenuItem = (id) => {
    return MENU_ITEMS.find((item) => item.id === id);
  };

  const sumItemQty = (items = [], fallbackQty = 0) => {
    if (!Array.isArray(items) || items.length === 0) {
      return Number.isFinite(fallbackQty) ? fallbackQty : 0;
    }
    return items.reduce(
      (total, item) => total + (Number(item.quantity) || 0),
      0
    );
  };

  const formatItemsHtml = (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="muted">-</p>';
    }
    return `
      <div class="items-list">
        ${items
          .map((item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            return `
              <div class="items-row">
                <span>${item.name}</span>
                <span>${qty} x ${formatRupiah(price)}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const generateQrDataUrl = async (text) => {
    if (!text) {
      return "";
    }
    if (!window.QRCode || typeof window.QRCode.toDataURL !== "function") {
      try {
        const data = await apiFetch(`/qr/${encodeURIComponent(text)}`);
        return data.dataUrl || "";
      } catch (error) {
        return "";
      }
    }
    return window.QRCode.toDataURL(text, {
      margin: 1,
      width: 240,
      color: {
        dark: "#1d1a16",
        light: "#ffffff",
      },
    });
  };

  const setProgressState = (root, activeStep) => {
    if (!root) {
      return;
    }

    const steps = Array.from(root.querySelectorAll(".progress-step"));
    if (!steps.length) {
      return;
    }

    const total = steps.length;
    const normalizedStep = Math.max(1, Math.min(total, Number(activeStep) || 1));
    const progress = total === 1 ? 100 : ((normalizedStep - 1) / (total - 1)) * 100;

    root.style.setProperty("--progress", `${progress}%`);
    steps.forEach((step, index) => {
      step.classList.toggle("active", index === normalizedStep - 1);
      step.classList.toggle("done", index < normalizedStep - 1);
    });
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

  const redirectToPreorder = () => {
    const targetUrl = "Preorder_Page.html";
    if (getCurrentPage() === targetUrl) {
      return;
    }
    if (document.body && !document.body.classList.contains("page-leave")) {
      navigateWithTransition(targetUrl);
      return;
    }
    window.location.href = targetUrl;
  };

  const enforcePreorderOnlyAccess = () => {
    if (!PREORDER_ONLY_ENABLED) {
      return;
    }

    if (!isWithinPreorderWindow()) {
      return;
    }

    const currentPage = getCurrentPage();
    if (PREORDER_ONLY_PAGES.has(currentPage)) {
      return;
    }

    accessBlocked = true;
    window.alert(PREORDER_ONLY_MESSAGE);
    redirectToPreorder();
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

  const resetPageTransitions = () => {
    if (!document.body) {
      return;
    }
    document.body.classList.remove("page-leave");
    document.body.classList.add("page-enter");
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
    sumItemQty,
    formatItemsHtml,
    generateQrDataUrl,
    setProgressState,
    navigateWithTransition,
    isPreorderOnlyActive: isWithinPreorderWindow,
    isPreorderOnlyEnabled: PREORDER_ONLY_ENABLED,
    preorderOnlyMessage: PREORDER_ONLY_MESSAGE,
    redirectToPreorder,
    isAccessBlocked: () => accessBlocked,
  };

  enforcePreorderOnlyAccess();

  window.addEventListener("pageshow", (event) => {
    if (event.persisted || document.body.classList.contains("page-leave")) {
      resetPageTransitions();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enablePageTransitions);
  } else {
    enablePageTransitions();
  }
})();
