import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "Main_Page.html"),
        cashier: resolve(__dirname, "Cashier_Page.html"),
        order: resolve(__dirname, "Order_Page.html"),
        payment: resolve(__dirname, "Payment_Page.html"),
        preorder: resolve(__dirname, "Preorder_Page.html"),
        preorderConfirm: resolve(__dirname, "Preorder_Confirm_Page.html"),
        preorderStatus: resolve(__dirname, "Preorder_Status_Page.html"),
        qrisPayment: resolve(__dirname, "Qris_Payment_Page.html"),
        queue: resolve(__dirname, "Queue_Page.html"),
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["kedaichilioil.duckdns.org"],
    port: 5173,
    open: "/Main_Page.html",
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
