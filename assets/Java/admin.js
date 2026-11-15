// ===== Halaman admin (DEMO, sisi-klien) =====
// Membaca pesanan dari localStorage browser INI saja ("wt_orders").
// Kata sandi admin disimpan sebagai hash di browser ini. Ini bukan keamanan
// sungguhan: orang yang memegang browser ini bisa membuka DevTools. Untuk toko
// sungguhan, admin harus lewat server + database.

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const KEY_ORDERS = "wt_orders";
const KEY_ADMIN = "wt_admin";
const KEY_SESS = "wt_admin_session";
const MIN_PASS = 8;
const MAX_FAIL = 5, LOCK_MS = 30000;

const STATUSES = ["Menunggu pembayaran", "Sudah dibayar", "Diproses", "Dikirim", "Selesai", "Dibatalkan"];
const METODE = { transfer: "Transfer", qris: "QRIS", cod: "COD" };

let orders = [];
let filter = "Semua";
let keyword = "";
let failCount = 0, lockedUntil = 0, openId = null;

// ---------- penyimpanan ----------
function read(storage, key, fallback) {
  try { const v = JSON.parse(storage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function loadOrders() {
  const raw = read(localStorage, KEY_ORDERS, []);
  orders = (Array.isArray(raw) ? raw : []).filter(o => o && o.id && o.penerima && Array.isArray(o.items));
}
function saveOrders() {
  try { localStorage.setItem(KEY_ORDERS, JSON.stringify(orders)); return true; }
  catch (e) { alert("Gagal menyimpan. Penyimpanan browser mungkin penuh atau dinonaktifkan."); return false; }
}

// ---------- hash kata sandi ----------
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hashPass(pass, saltB64) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromB64(saltB64), iterations: 150000, hash: "SHA-256" }, key, 256);
  return toB64(bits);
}
const newSalt = () => toB64(crypto.getRandomValues(new Uint8Array(16)));
const passOk = p => p.length >= MIN_PASS && /[A-Za-z]/.test(p) && /\d/.test(p);
const hasCrypto = () => window.crypto && crypto.subtle;

function msg(el, text, ok) { el.textContent = text; el.className = "adm-msg" + (ok ? " ok" : ""); el.hidden = false; }

// ---------- masuk ----------
function showAuth() {
  $("app").hidden = true; $("logout").hidden = true; $("auth").hidden = false;
  const hasAdmin = !!read(localStorage, KEY_ADMIN, null);
  $("setup-form").hidden = hasAdmin;
  $("login-form").hidden = !hasAdmin;
}
function showApp() {
  $("auth").hidden = true; $("app").hidden = false; $("logout").hidden = false;
  loadOrders(); render();
}

$("setup-form").addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("auth-msg"); m.hidden = true;
  if (!hasCrypto()) return msg(m, "Browser tidak mendukung enkripsi di sini. Buka lewat Live Server (localhost) atau HTTPS.");
  const p1 = $("s-pass").value, p2 = $("s-pass2").value;
  if (!passOk(p1)) return msg(m, "Kata sandi minimal 8 karakter dan harus berisi huruf dan angka.");
  if (p1 !== p2) return msg(m, "Kata sandi dan ulangannya tidak sama.");
  const salt = newSalt();
  try {
    localStorage.setItem(KEY_ADMIN, JSON.stringify({ salt, hash: await hashPass(p1, salt) }));
    sessionStorage.setItem(KEY_SESS, "1");
  } catch (x) { return msg(m, "Gagal menyimpan. Penyimpanan browser mungkin dinonaktifkan."); }
  $("setup-form").reset(); showApp();
});

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("auth-msg"); m.hidden = true;
  if (!hasCrypto()) return msg(m, "Browser tidak mendukung enkripsi di sini. Buka lewat Live Server (localhost) atau HTTPS.");
  const wait = lockedUntil - Date.now();
  if (wait > 0) return msg(m, "Terlalu banyak percobaan. Coba lagi dalam " + Math.ceil(wait / 1000) + " detik.");
  const adm = read(localStorage, KEY_ADMIN, null);
  if (!adm) return showAuth();
  const h = await hashPass($("l-pass").value, adm.salt);
  if (h !== adm.hash) {
    failCount++;
    if (failCount >= MAX_FAIL) { lockedUntil = Date.now() + LOCK_MS; failCount = 0; return msg(m, "Terlalu banyak percobaan. Coba lagi dalam 30 detik."); }
    return msg(m, "Kata sandi salah.");
  }
  failCount = 0;
  try { sessionStorage.setItem(KEY_SESS, "1"); } catch (x) {}
  $("login-form").reset(); showApp();
});

$("logout").addEventListener("click", () => {
  try { sessionStorage.removeItem(KEY_SESS); } catch (e) {}
  showAuth();
});

$("pw-form").addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("pw-msg"); m.hidden = true;
  const adm = read(localStorage, KEY_ADMIN, null);
  if (!adm || (await hashPass($("p-old").value, adm.salt)) !== adm.hash) return msg(m, "Kata sandi lama salah.");
  const np = $("p-new").value;
  if (!passOk(np)) return msg(m, "Kata sandi baru minimal 8 karakter dan harus berisi huruf dan angka.");
  const salt = newSalt();
  try { localStorage.setItem(KEY_ADMIN, JSON.stringify({ salt, hash: await hashPass(np, salt) })); }
  catch (x) { return msg(m, "Gagal menyimpan."); }
  $("pw-form").reset(); msg(m, "Kata sandi berhasil diganti.", true);
});

// ---------- tampilan ----------
const fmtTgl = iso => { const d = new Date(iso); return isNaN(d) ? "-" : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); };
const statusClass = s => s === "Menunggu pembayaran" ? "s-menunggu" : s === "Selesai" ? "s-selesai" : s === "Dibatalkan" ? "s-batal" : "";

function render() {
  // ringkasan
  const count = s => orders.filter(o => o.status === s).length;
  const selesai = orders.filter(o => o.status === "Selesai");
  const perluTindakan = count("Menunggu pembayaran") + count("Sudah dibayar");
  $("stats").innerHTML = [
    ["Total pesanan", orders.length],
    ["Perlu tindakan", perluTindakan],
    ["Selesai", selesai.length],
    ["Pendapatan (selesai)", rupiah(selesai.reduce((s, o) => s + (o.total || 0), 0))],
  ].map(([k, v]) => `<div class="stat"><span>${k}</span><strong>${esc(v)}</strong></div>`).join("");

  // filter status
  $("filters").innerHTML = ["Semua", ...STATUSES].map(s => {
    const n = s === "Semua" ? orders.length : count(s);
    return `<button class="chip${s === filter ? " active" : ""}" data-f="${esc(s)}">${esc(s)} (${n})</button>`;
  }).join("");

  // baris tabel
  const list = orders.filter(o =>
    (filter === "Semua" || o.status === filter) &&
    (o.id + " " + o.penerima.nama).toLowerCase().includes(keyword)
  ).sort((a, b) => String(b.waktu).localeCompare(String(a.waktu)));

  $("rows").innerHTML = list.map(o => `
    <tr>
      <td><b>${esc(o.id)}</b><span class="sub">${esc(fmtTgl(o.waktu))}</span></td>
      <td>${esc(o.penerima.nama)}<span class="sub">${esc(o.penerima.kota)}</span></td>
      <td>${esc(rupiah(o.total || 0))}</td>
      <td>${esc(METODE[o.metode] || o.metode)}</td>
      <td><select data-status="${esc(o.id)}" class="${statusClass(o.status)}" aria-label="Status ${esc(o.id)}">
        ${STATUSES.map(s => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}
      </select></td>
      <td><button class="linkbtn" data-detail="${esc(o.id)}">Detail</button></td>
    </tr>`).join("");
  $("empty").hidden = list.length > 0;
}

$("filters").addEventListener("click", e => {
  const b = e.target.closest("[data-f]"); if (!b) return;
  filter = b.dataset.f; render();
});
$("q").addEventListener("input", e => { keyword = e.target.value.trim().toLowerCase(); render(); });
$("reload").addEventListener("click", () => { loadOrders(); render(); });

$("rows").addEventListener("change", e => {
  const sel = e.target.closest("[data-status]"); if (!sel) return;
  const o = orders.find(x => x.id === sel.dataset.status); if (!o) return;
  const lama = o.status;
  o.status = sel.value;
  if (!saveOrders()) o.status = lama;
  render();
});
$("rows").addEventListener("click", e => {
  const b = e.target.closest("[data-detail]"); if (b) openDetail(b.dataset.detail);
});

// ---------- detail pesanan ----------
function waNumber(hp) {
  const d = String(hp).replace(/\D/g, "");
  return d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d;
}
function openDetail(id) {
  const o = orders.find(x => x.id === id); if (!o) return;
  openId = id;
  const p = o.penerima;
  $("dlg-title").textContent = "Pesanan " + o.id;
  $("dlg-body").innerHTML = `
    <div><h3>Barang</h3><ul>${o.items.map(i => `<li><span>${esc(i.nama)} × ${esc(i.qty)}</span><span>${esc(rupiah(i.harga * i.qty))}</span></li>`).join("")}
      <li><span>Ongkir (${esc(o.pengiriman)})</span><span>${esc(rupiah(o.ongkir || 0))}</span></li>
      <li><b>Total</b><b>${esc(rupiah(o.total || 0))}</b></li></ul></div>
    <div><h3>Penerima</h3>${esc(p.nama)}<br>${esc(p.hp)}<br>${esc(p.alamat)}, ${esc(p.kota)} ${esc(p.pos)}${p.catatan ? "<br><i>Catatan: " + esc(p.catatan) + "</i>" : ""}</div>
    <div><h3>Pembayaran</h3>${esc(METODE[o.metode] || o.metode)} · ${esc(o.status)}<br>Dibuat ${esc(fmtTgl(o.waktu))}</div>
    <div><h3>Akun pembeli</h3>${esc(o.email)}</div>`;
  const teks = `Halo ${p.nama}, pesanan ${o.id} (${rupiah(o.total || 0)}) berstatus: ${o.status}. Terima kasih sudah belanja di Warung Pras.`;
  $("dlg-wa").href = `https://wa.me/${waNumber(p.hp)}?text=${encodeURIComponent(teks)}`;
  const d = $("dlg");
  typeof d.showModal === "function" ? d.showModal() : d.setAttribute("open", "");
}
function closeDetail() { const d = $("dlg"); typeof d.close === "function" ? d.close() : d.removeAttribute("open"); openId = null; }
$("dlg-close").addEventListener("click", closeDetail);
$("dlg").addEventListener("click", e => { if (e.target === $("dlg")) closeDetail(); });
$("dlg-del").addEventListener("click", () => {
  if (!openId || !confirm("Hapus pesanan " + openId + "? Tindakan ini tidak bisa dibatalkan.")) return;
  orders = orders.filter(o => o.id !== openId);
  saveOrders(); closeDetail(); render();
});

// ---------- ekspor CSV ----------
function cell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // cegah rumus di Excel
  return '"' + s.replace(/"/g, '""') + '"';
}
$("export").addEventListener("click", () => {
  const head = ["Nomor", "Waktu", "Nama", "HP", "Alamat", "Kota", "Kode pos", "Pengiriman", "Metode", "Barang", "Ongkir", "Total", "Status"];
  const rows = orders.map(o => [o.id, o.waktu, o.penerima.nama, o.penerima.hp, o.penerima.alamat, o.penerima.kota, o.penerima.pos,
    o.pengiriman, METODE[o.metode] || o.metode, o.items.map(i => i.nama + " x" + i.qty).join("; "), o.ongkir, o.total, o.status]);
  const csv = "\ufeff" + [head, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "pesanan-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// pesanan baru dari tab lain muncul otomatis
window.addEventListener("storage", e => { if (e.key === KEY_ORDERS && !$("app").hidden) { loadOrders(); render(); } });

// ---------- mulai ----------
(read(sessionStorage, KEY_SESS, null) && read(localStorage, KEY_ADMIN, null)) ? showApp() : showAuth();