const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { scrapeInstagram } = require("./instagramScraper");
const { supabase } = require("./supabaseClient");

const app = express();
const PORT = process.env.PORT || 3000;
const DI_VERCEL = Boolean(process.env.VERCEL);

app.use(cors());
app.use(express.json());

// ==========================================
// 1. AMBIL DATA (dibaca dari Supabase)
// ==========================================
app.get("/api/instagram", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("instagram_posts")
      .select("*")
      .order("posted_at", { ascending: false, nullsFirst: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      source: "supabase",
      total: data.length,
      data
    });
  } catch (error) {
    console.error("Error membaca dari Supabase:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data dari database Supabase.",
      error: error.message
    });
  }
});

// ==========================================
// 2. SCRAPE -> SIMPAN KE SUPABASE
//    (scrapeInstagram sudah menyimpan ke Supabase)
// ==========================================
app.get("/api/instagram/scrape", async (req, res) => {
  try {
    console.log("Memicu scraping ke Apify...");
    const posts = await scrapeInstagram();

    res.status(200).json({
      success: true,
      message: "Scraping & sinkronisasi Supabase berhasil.",
      scraped: posts.length
    });
  } catch (error) {
    console.error("Error saat scraping:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan scraping atau menyimpan ke Supabase.",
      error: error.message
    });
  }
});

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// ==========================================
// 3. JADWAL HARIAN
//    Di Vercel dijalankan oleh Vercel Cron (vercel.json), di lokal oleh node-cron.
// ==========================================
if (!DI_VERCEL) {
  const cron = require("node-cron");
  cron.schedule("0 0 * * *", async () => {
    console.log("[CRON] Menjalankan scraping harian...");
    try {
      await scrapeInstagram();
      console.log("[CRON] Selesai, data tersimpan di Supabase.");
    } catch (err) {
      console.error("[CRON] Gagal:", err.message);
    }
  });
}

// Jalankan server hanya bila file ini dijalankan langsung (node server.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

// Agar Vercel bisa memakai app ini sebagai handler
module.exports = app;