// products, NOMOR_WA, dan rupiah() ada di data.js (dimuat sebelum file ini)

const $ = id => document.getElementById(id);

let cart = [];
let kategoriAktif = "semua";
let kataKunci = "";

// ====== VERIFIKASI USIA ======
(function ageGate() {
  try { if (sessionStorage.getItem("umur_ok") === "1") $("gate").classList.add("hide"); } catch (e) {}
  $("gate-yes").addEventListener("click", () => {
    try { sessionStorage.setItem("umur_ok", "1"); } catch (e) {}
    $("gate").classList.add("hide");
  });
  $("gate-no").addEventListener("click", () => {
    $("gate").querySelector(".gate-box").innerHTML =
      "<h2>Maaf</h2><p>Anda belum bisa mengakses toko ini. Silakan kembali setelah berusia 18 tahun.</p>";
  });
})();

// ====== TAMPILKAN PRODUK ======
function renderProducts() {
  const list = products.filter(p =>
    (kategoriAktif === "semua" || p.kategori === kategoriAktif) &&
    p.nama.toLowerCase().includes(kataKunci)
  );
  $("grid").innerHTML = list.map(p => `
    <article class="card">
      <div class="pack" style="background:${p.warna}">${p.nama}</div>
      <div class="card-body">
        <h3>${p.nama}</h3>
        <span class="meta">Isi ${p.isi}</span>
        <span class="price">${rupiah(p.harga)}</span>
        <button class="btn" data-add="${p.id}">Tambah ke keranjang</button>
      </div>
    </article>`).join("");
  $("empty").hidden = list.length > 0;
}

$("filters").addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  kategoriAktif = chip.dataset.cat;
  renderProducts();
});
$("search").addEventListener("input", e => {
  kataKunci = e.target.value.trim().toLowerCase();
  renderProducts();
});
$("grid").addEventListener("click", e => {
  const btn = e.target.closest("[data-add]");
  if (btn) addToCart(Number(btn.dataset.add));
});

// ====== KERANJANG ======
function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem("cart") || "[]");
    cart = Array.isArray(raw) ? raw.filter(i => products.some(p => p.id === i.id) && i.qty > 0) : [];
  } catch (e) { cart = []; }
}
function saveCart() {
  try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {}
}
function addToCart(id) {
  const item = cart.find(i => i.id === id);
  item ? item.qty++ : cart.push({ id, qty: 1 });
  saveCart(); renderCart();
  toast(products.find(p => p.id === id).nama + " masuk keranjang");
}
function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart(); renderCart();
}
function cartTotal() {
  return cart.reduce((sum, i) => sum + products.find(p => p.id === i.id).harga * i.qty, 0);
}
function renderCart() {
  $("cart-list").innerHTML = cart.map(i => {
    const p = products.find(x => x.id === i.id);
    return `<li class="cart-item">
      <span class="name">${p.nama}</span>
      <div class="qty">
        <button data-dec="${p.id}" aria-label="Kurangi">−</button>
        <span>${i.qty}</span>
        <button data-inc="${p.id}" aria-label="Tambah">+</button>
      </div>
      <span class="sub">${rupiah(p.harga)} × ${i.qty} = ${rupiah(p.harga * i.qty)}</span>
    </li>`;
  }).join("");
  const kosong = cart.length === 0;
  $("cart-empty").hidden = !kosong;
  $("cart-foot").hidden = kosong;
  $("cart-total").textContent = rupiah(cartTotal());
  $("cart-count").textContent = cart.reduce((s, i) => s + i.qty, 0);
}
$("cart-list").addEventListener("click", e => {
  if (e.target.dataset.inc) changeQty(Number(e.target.dataset.inc), 1);
  if (e.target.dataset.dec) changeQty(Number(e.target.dataset.dec), -1);
});
$("clear-cart").addEventListener("click", () => { cart = []; saveCart(); renderCart(); });

// buka / tutup keranjang
function toggleCart(open) {
  $("drawer").classList.toggle("open", open);
  $("drawer").setAttribute("aria-hidden", String(!open));
  $("overlay").hidden = !open;
}
$("open-cart").addEventListener("click", () => toggleCart(true));
$("close-cart").addEventListener("click", () => toggleCart(false));
$("overlay").addEventListener("click", () => toggleCart(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") toggleCart(false); });

// ====== CHECKOUT VIA WHATSAPP ======
$("checkout").addEventListener("click", () => {
  if (!cart.length) return;
  const nama = $("buyer-name").value.trim();
  const alamat = $("buyer-addr").value.trim();
  if (!nama || !alamat) return toast("Isi nama dan alamat dulu");
  const baris = cart.map(i => {
    const p = products.find(x => x.id === i.id);
    return `- ${p.nama} x${i.qty} = ${rupiah(p.harga * i.qty)}`;
  }).join("\n");
  const pesan = `Halo, saya mau pesan:\n${baris}\n\nTotal: ${rupiah(cartTotal())}\nNama: ${nama}\nAlamat: ${alamat}\n\nSaya berusia 18 tahun ke atas.`;
  window.open(`https://wa.me/${NOMOR_WA}?text=${encodeURIComponent(pesan)}`, "_blank");
});

// ====== NOTIFIKASI ======
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ====== MULAI ======
loadCart();
renderProducts();
renderCart();
