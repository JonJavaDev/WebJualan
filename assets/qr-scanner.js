/**
 * qr-scanner.js
 * Menangani scan QR tiket di halaman Kasir.
 * Berdiri sendiri — tidak menyentuh cashier.js atau fungsi lain.
 */

(function () {
  'use strict';

  // ── Konstanta ──────────────────────────────────────────────────────────────
  const HIGHLIGHT_CLASS = 'qr-highlight';
  const HIGHLIGHT_DURATION_MS = 4000;

  // ── Elemen DOM ─────────────────────────────────────────────────────────────
  const modal       = document.getElementById('qrModal');
  const closeBtn    = document.getElementById('qrCloseBtn');
  const scanBtn     = document.getElementById('scanQrBtn');
  const resultMsg   = document.getElementById('qrResultMsg');
  const readerBoxId = 'qrReaderBox';

  let scanner = null;
  let isScanning = false;

  // ── Utilitas ───────────────────────────────────────────────────────────────

  /**
   * Ekstrak orderId dari hasil scan.
   * QR bisa berisi:
   *   - URL: "...Queue_Page.html?orderId=123"  → ambil param orderId
   *   - URL: "...Cashier_Page.html?scan=123"  → ambil param scan
   *   - Plain ID: "123"                        → pakai langsung
   */
  function extractOrderId(raw) {
    raw = (raw || '').trim();
    try {
      const url = new URL(raw);
      return (
        url.searchParams.get('orderId') ||
        url.searchParams.get('scan')    ||
        url.searchParams.get('id')      ||
        null
      );
    } catch {
      // Bukan URL valid — coba parse sebagai query string saja
      if (raw.includes('=')) {
        const params = new URLSearchParams(raw.includes('?') ? raw.split('?')[1] : raw);
        return (
          params.get('orderId') ||
          params.get('scan')    ||
          params.get('id')      ||
          null
        );
      }
      // Anggap raw value IS the orderId (angka atau string pendek)
      return raw || null;
    }
  }

  /**
   * Cari elemen order card di DOM berdasarkan orderId.
   * Mencoba beberapa selector umum agar cocok dengan berbagai struktur cashier.js.
   */
  function findOrderCard(orderId) {
    if (!orderId) return null;
    const id = String(orderId);

    // Selector prioritas — sesuaikan jika cashier.js pakai atribut lain
    const selectors = [
      `[data-order-id="${id}"]`,
      `[data-id="${id}"]`,
      `[data-orderid="${id}"]`,
      `#order-${id}`,
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    // Fallback: cari di teks konten semua .order-card
    const cards = document.querySelectorAll('.order-card, .order-item, .order-row');
    for (const card of cards) {
      if (card.textContent.includes(id)) return card;
    }

    return null;
  }

  /**
   * Highlight & scroll ke kartu pesanan yang ditemukan.
   */
  function highlightOrder(orderId) {
    const card = findOrderCard(orderId);

    if (!card) {
      setMsg(`Pesanan #${orderId} tidak ditemukan di daftar.`, 'error');
      return false;
    }

    // Pastikan section yang benar terlihat (Pesanan Langsung vs Preorder)
    const section = card.closest('#ordersSection, #preordersSection');
    if (section) {
      const isPreorder = section.id === 'preordersSection';
      // Klik tab yang sesuai jika belum aktif
      const tabs = document.querySelectorAll('[data-view]');
      tabs.forEach(tab => {
        const targetView = isPreorder ? 'preorders' : 'orders';
        if (tab.dataset.view === targetView && !tab.classList.contains('active')) {
          tab.click();
        }
      });
    }

    // Hapus highlight lama jika ada
    document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => {
      el.classList.remove(HIGHLIGHT_CLASS);
    });

    // Scroll + highlight
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add(HIGHLIGHT_CLASS);

    setTimeout(() => card.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_DURATION_MS);
    return true;
  }

  function setMsg(text, type = '') {
    resultMsg.textContent = text;
    resultMsg.className   = type ? `form-message ${type}` : 'muted';
  }

  // ── Scanner lifecycle ──────────────────────────────────────────────────────

  async function startScanner() {
    if (isScanning) return;
    setMsg('Memulai kamera…');

    scanner = new Html5Qrcode(readerBoxId);

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    try {
      await scanner.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        /* onScanFailure — silent */ () => {}
      );
      isScanning = true;
      setMsg('Arahkan kamera ke QR tiket pelanggan.');
    } catch (err) {
      setMsg('Tidak bisa akses kamera: ' + err, 'error');
    }
  }

  async function stopScanner() {
    if (!scanner || !isScanning) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch { /* ignore */ }
    scanner    = null;
    isScanning = false;
  }

  // ── Handler scan berhasil ──────────────────────────────────────────────────

  async function onScanSuccess(decodedText) {
    // Langsung stop supaya tidak scan ulang
    await stopScanner();

    const orderId = extractOrderId(decodedText);

    if (!orderId) {
      setMsg('QR tidak dikenali. Pastikan QR dari tiket pesanan.', 'error');
      return;
    }

    setMsg(`Pesanan #${orderId} ditemukan, mengarahkan…`, 'success');

    // Tutup modal setelah sebentar supaya user lihat pesan sukses
    setTimeout(() => {
      closeModal();
      const found = highlightOrder(orderId);
      if (!found) {
        // Pesanan tidak ada di DOM — mungkin belum di-refresh
        alert(`Pesanan #${orderId} tidak ada di daftar. Coba klik "Refresh daftar" dulu.`);
      }
    }, 800);
  }

  // ── Modal open / close ─────────────────────────────────────────────────────

  function openModal() {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    setMsg('Arahkan kamera ke QR tiket pelanggan.');
    startScanner();
  }

  function closeModal() {
    stopScanner();
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    // Bersihkan konten reader agar tidak ada artefak
    const box = document.getElementById(readerBoxId);
    if (box) box.innerHTML = '';
  }

  // ── Tangani QR yang di-scan dari HP (buka URL langsung) ───────────────────
  // Contoh: kasir scan QR → HP buka Cashier_Page.html?scan=42
  function handleUrlScanParam() {
    const params = new URLSearchParams(window.location.search);
    const id     = params.get('scan') || params.get('orderId');
    if (!id) return;

    // Tunggu cashier.js selesai render daftar pesanan (~800ms biasanya cukup)
    setTimeout(() => {
      const found = highlightOrder(id);
      if (!found) {
        // Coba lagi sekali setelah delay lebih panjang
        setTimeout(() => {
          if (!highlightOrder(id)) {
            alert(`Pesanan #${id} tidak ada di daftar. Pastikan sudah login dan klik Refresh.`);
          }
        }, 2000);
      }
    }, 800);
  }

  // ── Event listeners ────────────────────────────────────────────────────────

  if (scanBtn)  scanBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Tutup modal kalau klik di luar dialog
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });
  }

  // Tutup dengan Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) closeModal();
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', handleUrlScanParam);

})();