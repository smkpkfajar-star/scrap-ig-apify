const express = require("express");
const fs = require("fs");
const cron = require("node-cron");
const cors = require("cors");
const { scrapeInstagram, filePath } = require("./scraper");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ⏰ Jadwal Cron: Berjalan otomatis setiap 5 jam sekali
cron.schedule("0 */5 * * *", async () => {
  console.log("⏰ [CRON JOB] Menjalankan update otomatis 5 jam sekali...");
  try {
    await scrapeInstagram();
  } catch (err) {
    console.error("Gagal melakukan cron scraping:", err.message);
  }
});

// --- ENDPOINT API UNTUK FRONTEND ---

// 1. Endpoint untuk membaca file JSON (Dipanggil oleh Website Anda)
app.get("/api/posts", (req, res) => {
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File JSON belum ada. Silakan akses /api/force-scrape untuk membuat data awal."
      });
    }

    const rawData = fs.readFileSync(filePath, "utf8");
    const posts = JSON.parse(rawData);

    res.status(200).json({
      success: true,
      total: posts.length,
      data: posts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Endpoint darurat untuk memaksa scraping manual lewat browser/Postman
app.get("/api/force-scrape", async (req, res) => {
  try {
    await scrapeInstagram();
    res.json({ success: true, message: "Scraping manual berhasil dijalankan dan file JSON diperbarui!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  
  // Jalankan sekali saat server pertama kali menyala jika file JSON belum ada
  if (!fs.existsSync(filePath)) {
    console.log("📁 File JSON belum ditemukan, melakukan initial scraping...");
    await scrapeInstagram();
  }
});