const express = require("express");
const fs = require("fs");
const cron = require("node-cron");
const cors = require("cors");
const { scrapeInstagram, filePath } = require("./scraper");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Password rahasia untuk trigger manual (Ubah sesuai keinginan Anda)
const MY_SECRET = "rahasia_sekolah_12345";

// --- 1. ENDPOINT KHUSUS KEEP-ALIVE PING ---
// Dipanggil oleh Cron-Job.org / UptimeRobot setiap 12 menit
app.get("/ping", (req, res) => {
  console.log("Berhasil di reboot oleh cronjob");
  
  res.status(200).send("OK");
});

// --- 2. ENDPOINT UNTUK MEMBACA DATA INSTAGRAM (DIPANGGUL FRONTEND) ---
app.get("/api/posts", (req, res) => {
  try {
    // Jika file JSON belum ada, beri respon sukses dengan data kosong (Mencegah Error 500)
    if (!fs.existsSync(filePath)) {
      return res.status(200).json({
        success: true,
        message: "Data belum tersedia, file JSON belum dibuat.",
        total: 0,
        data: []
      });
    }

    const rawData = fs.readFileSync(filePath, "utf8");

    // Jika file ada tapi isinya kosong/whitespace
    if (!rawData || !rawData.trim()) {
      return res.status(200).json({
        success: true,
        message: "File JSON masih kosong.",
        total: 0,
        data: []
      });
    }

    const posts = JSON.parse(rawData);

    return res.status(200).json({
      success: true,
      total: posts.length,
      data: posts
    });
  } catch (error) {
    console.error("❌ Gagal membaca file JSON:", error.message);
    return res.status(200).json({
      success: false,
      message: "Gagal membaca file JSON, silakan jalankan force-scrape.",
      total: 0,
      data: []
    });
  }
});

// --- 3. ENDPOINT DARURAT UNTUK SCRAPING MANUAL (DENGAN SECRET KEY) ---
app.get("/api/force-scrape", async (req, res) => {
  const secret = req.query.secret;

  if (secret !== MY_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak: Secret Key tidak valid!"
    });
  }

  try {
    await scrapeInstagram(true);
    res.json({
      success: true,
      message: "Scraping manual berhasil dijalankan dan file JSON diperbarui!"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 4. JADWAL CRON JOB (SETIAP HARI JAM 06:00 WIB) ---
cron.schedule(
  "* 6 * * *",
  async () => {
    console.log("⏰ [CRON JOB] Menjalankan update otomatis jam 06:00 WIB...");
    try {
      await scrapeInstagram(true);
      console.log("✅ Scraping otomatis jam 08:35 WIB selesai!");
    } catch (err) {
      console.error("❌ Gagal cron jam 6 pagi:", err.message);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Jakarta" // Mengunci jadwal ke WIB (GMT+7)
  }
);

// --- MENJALANKAN SERVER ---
app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);

  // Jalankan initial scraping saat server menyala JIKA file JSON belum ada
  if (!fs.existsSync(filePath)) {
    console.log("📁 File JSON belum ditemukan, melakukan initial scraping...");
    try {
      await scrapeInstagram(true);
      console.log("✅ Initial scraping selesai!");
    } catch (err) {
      console.error("❌ Gagal initial scraping:", err.message);
    }
  }
});