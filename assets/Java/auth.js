// ===== Demo login sisi-klien =====
// PENTING: data akun disimpan di localStorage browser. Ini hanya untuk
// latihan/demo. Untuk toko sungguhan, login HARUS diproses server
// (database + hash di server + HTTPS).

const $ = id => document.getElementById(id);
const USERS_KEY = "wt_users";
const SESSION_KEY = "wt_session";
const MIN_AGE = 21;
const MAX_FAIL = 5;
const LOCK_MS = 30000;

let failCount = 0;
let lockedUntil = 0;

// ---------- Penyimpanan ----------
function getUsers() {
  try {
    const u = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(u) ? u : [];
  } catch (e) { return []; }
}
function saveUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); return true; }
  catch (e) { return false; }
}
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
  catch (e) { return null; }
}

// ---------- Hash kata sandi (PBKDF2 + salt) ----------
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromB64(saltB64), iterations: 150000, hash: "SHA-256" }, key, 256);
  return toB64(bits);
}
const newSalt = () => toB64(crypto.getRandomValues(new Uint8Array(16)));

// ---------- Validasi ----------
function ageFrom(dobStr) {
  const dob = new Date(dobStr);
  if (isNaN(dob)) return -1;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const passOk = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

// ---------- Pesan ----------
function showMsg(text, type = "error") {
  const m = $("msg");
  m.textContent = text;
  m.className = "msg " + type;
  m.hidden = false;
}
function clearMsg() { $("msg").hidden = true; }

// ---------- Tab ----------
function switchTab(which) {
  const login = which === "login";
  $("form-login").hidden = !login;
  $("form-register").hidden = login;
  $("tab-login").classList.toggle("active", login);
  $("tab-register").classList.toggle("active", !login);
  $("tab-login").setAttribute("aria-selected", String(login));
  $("tab-register").setAttribute("aria-selected", String(!login));
  clearMsg();
}
$("tab-login").addEventListener("click", () => switchTab("login"));
$("tab-register").addEventListener("click", () => switchTab("register"));

// ---------- Tampilkan kata sandi ----------
document.querySelectorAll(".show-pass").forEach(cb => {
  cb.addEventListener("change", () => {
    cb.closest("form").querySelectorAll("input[type=password], input[data-pw]").forEach(inp => {
      inp.type = cb.checked ? "text" : "password";
      inp.dataset.pw = "1";
    });
  });
});

// ---------- Daftar ----------
$("form-register").addEventListener("submit", async e => {
  e.preventDefault();
  clearMsg();
  if (!window.crypto || !crypto.subtle)
    return showMsg("Browser tidak mendukung enkripsi di sini. Buka lewat Live Server (localhost) atau HTTPS.");

  const nama = $("r-name").value.trim();
  const email = $("r-email").value.trim().toLowerCase();
  const dob = $("r-dob").value;
  const pass = $("r-pass").value;
  const pass2 = $("r-pass2").value;

  if (nama.length < 2) return showMsg("Isi nama lengkap Anda.");
  if (!emailOk(email)) return showMsg("Format email tidak valid.");
  if (!dob) return showMsg("Isi tanggal lahir Anda.");
  if (ageFrom(dob) < MIN_AGE)
    return showMsg("Maaf, pembeli harus berusia minimal " + MIN_AGE + " tahun.");
  if (!passOk(pass)) return showMsg("Kata sandi minimal 8 karakter dan harus berisi huruf dan angka.");
  if (pass !== pass2) return showMsg("Kata sandi dan ulangannya tidak sama.");

  const users = getUsers();
  if (users.some(u => u.email === email)) return showMsg("Email ini sudah terdaftar. Silakan masuk.");

  const salt = newSalt();
  const hash = await hashPassword(pass, salt);
  users.push({ nama, email, dob, salt, hash });
  if (!saveUsers(users)) return showMsg("Gagal menyimpan akun. Penyimpanan browser mungkin dinonaktifkan.");

  $("form-register").reset();
  switchTab("login");
  $("l-email").value = email;
  showMsg("Akun berhasil dibuat. Silakan masuk.", "ok");
});

// ---------- Masuk ----------
$("form-login").addEventListener("submit", async e => {
  e.preventDefault();
  clearMsg();
  if (!window.crypto || !crypto.subtle)
    return showMsg("Browser tidak mendukung enkripsi di sini. Buka lewat Live Server (localhost) atau HTTPS.");

  const wait = lockedUntil - Date.now();
  if (wait > 0) return showMsg("Terlalu banyak percobaan. Coba lagi dalam " + Math.ceil(wait / 1000) + " detik.");

  const email = $("l-email").value.trim().toLowerCase();
  const pass = $("l-pass").value;
  if (!emailOk(email) || !pass) return showMsg("Isi email dan kata sandi.");

  const user = getUsers().find(u => u.email === email);
  // Hash tetap dihitung agar waktu respons mirip, baik email ada maupun tidak
  const hash = await hashPassword(pass, user ? user.salt : newSalt());

  if (!user || hash !== user.hash) {
    failCount++;
    if (failCount >= MAX_FAIL) {
      lockedUntil = Date.now() + LOCK_MS;
      failCount = 0;
      return showMsg("Terlalu banyak percobaan. Coba lagi dalam 30 detik.");
    }
    return showMsg("Email atau kata sandi salah.");
  }

  failCount = 0;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ nama: user.nama, email: user.email }));
  } catch (err) {
    return showMsg("Gagal menyimpan sesi login.");
  }
  window.location.href = "index.html";
});

// ---------- Keluar & status ----------
$("logout").addEventListener("click", () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  showForms();
});

function showForms() {
  $("signed-in").hidden = true;
  $("forms").hidden = false;
}
function showSignedIn(s) {
  $("user-name").textContent = s.nama;
  $("user-email").textContent = s.email;
  $("signed-in").hidden = false;
  $("forms").hidden = true;
}

// ---------- Mulai ----------
const session = getSession();
if (session && session.nama) showSignedIn(session);
