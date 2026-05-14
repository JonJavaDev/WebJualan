# WebJualan Server

Backend Node.js + Express + SQL Server (Windows Authentication) untuk menyimpan pesanan dan mock cek QRIS.

## Setup singkat
1. Buat database SQL Server, lalu jalankan schema: schema.sql.
2. Salin .env.example menjadi .env dan isi konfigurasi SQL Server (Windows Auth) + ADMIN_KEY.
3. Install dependencies: npm install
4. Jalankan server: npm run dev

Catatan: Untuk Windows Authentication, server Node harus berjalan di mesin yang punya akses Windows ke SQL Server.

Kasir: buka Cashier_Page.html di PC kasir, lalu masukkan ADMIN_KEY untuk konfirmasi pembayaran.

Flow pembeli:
- Order biasa: Main_Page -> Order_Page -> Queue_Page -> (QRIS: Qris_Payment_Page -> Payment_Page, Tunai: Payment_Page)
- Preorder: Main_Page -> Preorder_Page -> Preorder_Confirm_Page

Server berjalan di http://localhost:3000
