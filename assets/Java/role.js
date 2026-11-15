// Pilihan masuk: Pembeli atau Admin (halaman login.html)
// Dimuat SETELAH auth.js. Dibungkus fungsi agar tidak bentrok nama dengan auth.js.
(function () {
  const g = id => document.getElementById(id);
  const ADMIN_KEY = "wt_admin";          // sama dengan admin.js
  const ADMIN_SESS = "wt_admin_session"; // sama dengan admin.js
  const MAX_FAIL = 5, LOCK_MS = 30000;
  let fails = 0, lockedUntil = 0;

  const read = (store, key) => { try { return JSON.parse(store.getItem(key)); } catch (e) { return null; } };
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

  async function hash(pass, saltB64) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: fromB64(saltB64), iterations: 150000, hash: "SHA-256" }, key, 256);
    return toB64(bits);
  }
  function msg(text) { const m = g("adm-msg"); m.textContent = text; m.hidden = false; }

  // tampilan kotak admin menurut kondisi
  function renderAdmin() {
    g("adm-msg").hidden = true;
    const adm = read(localStorage, ADMIN_KEY);
    const loggedIn = !!read(sessionStorage, ADMIN_SESS) && !!adm;
    g("adm-none").hidden = !!adm;
    g("adm-already").hidden = !loggedIn;
    g("adm-form").hidden = !adm || loggedIn;
  }

  function selectRole(role) {
    const admin = role === "admin";
    document.querySelectorAll("[data-role]").forEach(b => {
      const on = b.dataset.role === role;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    g("admin-box").hidden = !admin;
    if (admin) {
      g("forms").hidden = true;
      g("signed-in").hidden = true;
      renderAdmin();
    } else {
      const s = read(sessionStorage, "wt_session");
      const masuk = !!(s && s.nama);
      g("signed-in").hidden = !masuk;
      g("forms").hidden = masuk;
    }
  }

  document.querySelectorAll("[data-role]").forEach(b =>
    b.addEventListener("click", () => selectRole(b.dataset.role)));

  g("adm-show").addEventListener("change", e => { g("adm-pass").type = e.target.checked ? "text" : "password"; });

  g("adm-form").addEventListener("submit", async e => {
    e.preventDefault();
    g("adm-msg").hidden = true;
    if (!window.crypto || !crypto.subtle)
      return msg("Browser tidak mendukung enkripsi di sini. Buka lewat Live Server (localhost) atau HTTPS.");
    const wait = lockedUntil - Date.now();
    if (wait > 0) return msg("Terlalu banyak percobaan. Coba lagi dalam " + Math.ceil(wait / 1000) + " detik.");
    const adm = read(localStorage, ADMIN_KEY);
    if (!adm) return renderAdmin();
    if ((await hash(g("adm-pass").value, adm.salt)) !== adm.hash) {
      fails++;
      if (fails >= MAX_FAIL) { lockedUntil = Date.now() + LOCK_MS; fails = 0; return msg("Terlalu banyak percobaan. Coba lagi dalam 30 detik."); }
      return msg("Kata sandi admin salah.");
    }
    fails = 0;
    try { sessionStorage.setItem(ADMIN_SESS, "1"); } catch (x) { return msg("Gagal menyimpan sesi login."); }
    window.location.href = "admin.html";
  });

  // login.html#admin langsung membuka pilihan admin
  if (location.hash === "#admin") selectRole("admin");
})();
