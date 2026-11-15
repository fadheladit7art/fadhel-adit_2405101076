// ===== Halaman pembayaran (DEMO) =====
// Tidak ada pembayaran sungguhan di sini. Pesanan hanya dicatat di browser dan
// pembeli diarahkan membayar manual (transfer / QRIS / COD) lalu konfirmasi via WhatsApp.
// Untuk pembayaran otomatis diperlukan payment gateway + server.

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MIN_AGE = 21;

function read(storage, key, fallback) {
  try { const v = JSON.parse(storage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function ageFrom(dobStr) {
  const dob = new Date(dobStr);
  if (isNaN(dob)) return -1;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
function showState(html) {
  $("state").innerHTML = html;
  $("state").hidden = false;
}

// ---------- Cek syarat: login, usia, keranjang ----------
const session = read(sessionStorage, "wt_session", null);
const user = session && read(localStorage, "wt_users", []).find(u => u.email === session.email);
const rawCart = read(localStorage, "cart", []);
const items = (Array.isArray(rawCart) ? rawCart : [])
  .filter(i => i && i.qty > 0 && products.some(p => p.id === i.id))
  .map(i => ({ ...products.find(p => p.id === i.id), qty: i.qty }));

const subtotal = items.reduce((s, i) => s + i.harga * i.qty, 0);
const shipCost = () => ONGKIR[document.querySelector("[name=ship]:checked").value];

if (!user) {
  showState('<p>Anda harus masuk dulu sebelum membayar.</p><a class="btn" href="login.html">Masuk atau daftar</a>');
} else if (ageFrom(user.dob) < MIN_AGE) {
  showState("<p>Maaf, pembelian produk tembakau hanya untuk usia " + MIN_AGE + " tahun ke atas.</p>");
} else if (!items.length) {
  showState('<p>Keranjang Anda kosong.</p><a class="btn" href="index.html#produk">Pilih produk</a>');
} else {
  $("checkout-view").hidden = false;
  $("p-name").value = user.nama;
  renderSummary();
}

// ---------- Ringkasan ----------
function renderSummary() {
  $("sum-items").innerHTML = items.map(i =>
    `<li><span>${esc(i.nama)} × ${i.qty}</span><span>${rupiah(i.harga * i.qty)}</span></li>`).join("");
  $("sum-sub").textContent = rupiah(subtotal);
  $("sum-ship").textContent = rupiah(shipCost());
  $("sum-total").textContent = rupiah(subtotal + shipCost());
}
document.querySelectorAll("[name=ship]").forEach(r => r.addEventListener("change", renderSummary));

// ---------- Kirim pesanan ----------
function err(text) { const m = $("msg"); m.textContent = text; m.hidden = false; m.scrollIntoView({ block: "center" }); }

$("pay-form").addEventListener("submit", e => {
  e.preventDefault();
  $("msg").hidden = true;

  const nama = $("p-name").value.trim();
  const hp = $("p-phone").value.replace(/[\s-]/g, "");
  const alamat = $("p-addr").value.trim();
  const kota = $("p-city").value.trim();
  const pos = $("p-zip").value.trim();
  const catatan = $("p-note").value.trim();
  const ship = document.querySelector("[name=ship]:checked").value;
  const methodEl = document.querySelector("[name=method]:checked");

  if (nama.length < 2) return err("Isi nama penerima.");
  if (!/^(\+62|62|0)8\d{7,12}$/.test(hp)) return err("Nomor HP tidak valid. Contoh: 08123456789.");
  if (alamat.length < 10) return err("Alamat terlalu singkat. Tulis lengkap dengan jalan, nomor, RT/RW.");
  if (!kota) return err("Isi nama kota.");
  if (!/^\d{5}$/.test(pos)) return err("Kode pos harus 5 angka.");
  if (!methodEl) return err("Pilih metode pembayaran.");
  if (!$("p-agree").checked) return err("Anda harus menyetujui pernyataan usia dan pemeriksaan KTP.");

  const total = subtotal + ONGKIR[ship];
  const d = new Date();
  const tgl = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const rand = String(crypto.getRandomValues(new Uint16Array(1))[0] % 10000).padStart(4, "0");
  const order = {
    id: `WT-${tgl}-${rand}`,
    waktu: d.toISOString(),
    email: user.email,
    items: items.map(i => ({ id: i.id, nama: i.nama, harga: i.harga, qty: i.qty })),
    ongkir: ONGKIR[ship], pengiriman: ship, total,
    metode: methodEl.value,
    penerima: { nama, hp, alamat, kota, pos, catatan },
    status: "Menunggu pembayaran",
  };

  try {
    const orders = read(localStorage, "wt_orders", []);
    orders.push(order);
    localStorage.setItem("wt_orders", JSON.stringify(orders));
    localStorage.setItem("cart", "[]");
  } catch (x) { return err("Gagal menyimpan pesanan. Penyimpanan browser mungkin dinonaktifkan."); }

  showDone(order);
});

// ---------- Konfirmasi ----------
function showDone(o) {
  $("checkout-view").hidden = true;
  $("done-view").hidden = false;
  $("d-id").textContent = o.id;
  $("d-total").textContent = rupiah(o.total);

  let instr = "";
  if (o.metode === "transfer") {
    instr = "<p>Transfer <b>tepat " + rupiah(o.total) + "</b> ke salah satu rekening berikut dalam 24 jam:</p>" +
      REKENING.map(r => `<div class="bank"><b>${esc(r.bank)}</b> ${esc(r.no)}<br>a.n. ${esc(r.an)}</div>`).join("") +
      "<p>Setelah transfer, kirim bukti pembayaran lewat WhatsApp.</p>";
  } else if (o.metode === "qris") {
    instr = '<p>Scan kode QRIS toko, lalu bayar <b>tepat ' + rupiah(o.total) + "</b>.</p>" +
      '<div class="qris">Letakkan gambar QRIS Anda di <code>images/qris.png</code> dan tampilkan di sini.</div>' +
      "<p>Kirim bukti pembayaran lewat WhatsApp.</p>";
  } else {
    instr = "<p>Siapkan uang tunai <b>" + rupiah(o.total) + "</b> (uang pas lebih baik). Kurir akan memeriksa KTP asli Anda. Jika pembeli berusia di bawah 21 tahun atau tidak menunjukkan KTP, pesanan dibatalkan.</p>";
  }
  $("d-instr").innerHTML = instr;

  const baris = o.items.map(i => `- ${i.nama} x${i.qty} = ${rupiah(i.harga * i.qty)}`).join("\n");
  const metode = { transfer: "Transfer bank", qris: "QRIS", cod: "Bayar di tempat (COD)" }[o.metode];
  const pesan = `Halo, saya sudah membuat pesanan ${o.id}.\n${baris}\nOngkir: ${rupiah(o.ongkir)}\nTotal: ${rupiah(o.total)}\nPembayaran: ${metode}\n\nPenerima: ${o.penerima.nama} (${o.penerima.hp})\nAlamat: ${o.penerima.alamat}, ${o.penerima.kota} ${o.penerima.pos}`;
  $("d-wa").href = `https://wa.me/${NOMOR_WA}?text=${encodeURIComponent(pesan)}`;
  window.scrollTo({ top: 0 });
}
