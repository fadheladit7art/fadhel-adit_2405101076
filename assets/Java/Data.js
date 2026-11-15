// ====== DATA PRODUK (HARGA CONTOH: ganti dengan harga jual Anda) ======
const NOMOR_WA = "6285812325801"; // ganti dengan nomor WhatsApp penjual (format 62...)

const products = [
  { id: 1, nama: "Sampoerna A Mild",         kategori: "filter",  isi: "1 bungkus", harga: 36000, gambar: "assets/Foto/sampoerna-a-mild.webp" },
  { id: 2, nama: "Urban Mild Watermelon",    kategori: "filter",  isi: "1 bungkus", harga: 25000, gambar: "assets/Foto/urban-mild-watermelon.jpg" },
  { id: 3, nama: "Magnum Filter",            kategori: "filter",  isi: "1 bungkus", harga: 33000, gambar: "assets/Foto/8999909001909DjiSamS_f4d72f25-5d24-4b6c-9701-0d6c88d0ffb0_400x400.jpg" },
  { id: 4, nama: "Andalan Baru 16",          kategori: "kretek",  isi: "16 batang", harga: 28000, gambar: "assets/Foto/andalan-baru.webp" },
  { id: 5, nama: "Djarum Black Matcha 12",   kategori: "kretek",  isi: "12 batang", harga: 30000, gambar: "assets/Foto/djarum-black-matcha.png" },
  { id: 6, nama: "Dji Sam Soe Maestro Edition", kategori: "kretek", isi: "1 bungkus", harga: 70000, gambar: "assets/Foto/dji-sam-soe-maestro.png" },
  { id: 7, nama: "Royal Bourbon Rolling Tobacco", kategori: "linting", isi: "1 kantong", harga: 45000, gambar: "assets/Foto/royal-bourbon.jpg" },
];

const rupiah = n => "Rp" + n.toLocaleString("id-ID");

// ====== DATA PEMBAYARAN (ganti dengan data asli Anda) ======
const ONGKIR = { reguler: 15000, ekspres: 30000 };
const REKENING = [
  { bank: "BCA",     no: "1234567890", an: "Warung Tembakau" },
  { bank: "BRI",     no: "0987654321", an: "Warung Tembakau" },
  { bank: "Mandiri", no: "1122334455", an: "Warung Tembakau" },
];

const QRIS_GAMBAR = "assets/Foto/dana.jpeg";
