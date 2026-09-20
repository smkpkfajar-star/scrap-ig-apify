const express = require("express");
const fs = require("fs");
const cron = require("node-cron");
const cors = require("cors");
const axios = require("axios");
const { scrapeInstagram, filePath } = require("./scraper");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Password rahasia untuk trigger manual
const MY_SECRET = "rahasia_sekolah_12345";

// URL Render milik Anda
const RENDER_APP_URL = "https://scrap-ig-apify.onrender.com";

// --- 1. MENCEGAH RENDER SLEEP (KEEP-ALIVE PING) ---
function keepAlive() {
  // 1. Eksekusi ping pertama LANGSUNG tanpa menunggu delay/interval
  sendPing();

  // 2. Pasang interval setiap 10 detik (Khusus Testing)
  // ⚠️ Nanti kalau sudah berhasil, ganti 10 * 1000 jadi (14 * 60 * 1000)
  const INTERVAL_TIME = 10 * 1000;

  setInterval(() => {
    sendPing();
  }, INTERVAL_TIME);
}

// Fungsi terpisah untuk panggil ping
async function sendPing() {
  try {
    const res = await axios.get(`${RENDER_APP_URL}/api/posts`, { timeout: 15000 });
    console.log(
      `[${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}] 🔄 Keep-alive SUCCESS (${res.status})`
    );
  } catch (err) {
    if (err.response) {
      console.error(`⚠️ Ping gagal! Status Server: ${err.response.status}`);
    } else if (err.code === "ECONNABORTED") {
      console.error("⚠️ Ping gagal: Request Timeout");
    } else {
      console.error("⚠️ Ping keep-alive gagal:", err.message);
    }
  }
}

// --- 2. JADWAL CRON JOB (JAM 06:00 WIB SETIAP HARI) ---
cron.schedule(
  "0 6 * * *",
  async () => {
    console.log("⏰ [CRON JOB] Menjalankan update otomatis jam 06:00 WIB...");
    try {
      await scrapeInstagram(true);
      console.log("✅ Scraping otomatis jam 6 pagi selesai & JSON ter-update!");
    } catch (err) {
      console.error("❌ Gagal cron:", err.message);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Jakarta", // Mengunci jadwal ke WIB (GMT+7)
  }
);

// --- ENDPOINT API ---

// 1. Endpoint untuk membaca file JSON (Dipanggil oleh Frontend / Ping)
app.get("/api/posts", (req, res) => {
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message:
          "File JSON belum ada. Silakan akses /api/force-scrape untuk membuat data awal.",
      });
    }

    const rawData = fs.readFileSync(filePath, "utf8");
    const posts = JSON.parse(rawData);

    res.status(200).json({
      success: true,
      total: posts.length,
      data: posts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Endpoint darurat untuk pemicu manual (Membutuhkan Secret Key)
app.get("/api/force-scrape", async (req, res) => {
  const secret = req.query.secret;

  if (secret !== MY_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak: Secret Key tidak valid!",
    });
  }

  try {
    await scrapeInstagram(true);
    res.json({
      success: true,
      message: "Scraping manual berhasil dijalankan dan file JSON diperbarui!",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- MENJALANKAN SERVER ---
app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);

  // Jalankan interval anti-sleep
  keepAlive();

  // Jalankan scraping awal jika file JSON belum ada sama sekali
  if (!fs.existsSync(filePath)) {
    console.log("📁 File JSON belum ditemukan, melakukan initial scraping...");
    try {
      await scrapeInstagram(true);
    } catch (err) {
      console.error("❌ Gagal initial scraping:", err.message);
    }
  }
});