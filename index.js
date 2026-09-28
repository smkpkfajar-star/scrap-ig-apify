const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();

const { scrapeInstagram } = require("./instagramScraper");
// 🛠️ PERBAIKAN 1: Import saveToSupabase dari supabaseClient
const { supabase, saveToSupabase } = require("./supabaseClient");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// 1. ENDPOINT AMBIL DATA (MENAMPILKAN JSON DARI SUPABASE)
// ==========================================
app.get("/api/instagram", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("instagram_posts")
      .select("*")
      .order("posted_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      source: "supabase",
      total: data.length,
      data: data,
    });
  } catch (error) {
    console.error("❌ Error membaca dari Supabase:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data dari database Supabase.",
      error: error.message,
    });
  }
});

// ==========================================
// 2. ENDPOINT SCRAPE -> SIMPAN TO SUPABASE -> TAMPILKAN JSON
// ==========================================
app.get("/api/instagram/scrape", async (req, res) => {
  try {
    console.log("⚙️ Memicu scraping manual ke Apify...");
    
    // 1. Scrape
    const freshPosts = await scrapeInstagram(true);

    // 🛠️ PERBAIKAN 2: Simpan ke Supabase secara otomatis
    if (freshPosts && freshPosts.length > 0) {
      await saveToSupabase(freshPosts);
    }

    // 2. Ambil data terbaru dari Supabase untuk ditampilkan sebagai JSON
    const { data: updatedData, error: dbError } = await supabase
      .from("instagram_posts")
      .select("*")
      .order("posted_at", { ascending: false });

    if (dbError) throw dbError;

    // 3. Tampilkan JSON hasilnya
    res.status(200).json({
      success: true,
      message: "Scraping & Sinkronisasi Supabase berhasil!",
      total: updatedData.length,
      data: updatedData,
    });
  } catch (error) {
    console.error("❌ Error saat scraping manual:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan scraping atau menyimpan ke Supabase.",
      error: error.message,
    });
  }
});

// ==========================================
// 3. AUTOMATION (CRON JOB HARIAN)
// ==========================================
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ [CRON JOB] Menjalankan scraping otomatis harian...");
  try {
    const freshPosts = await scrapeInstagram(true);
    
    // 🛠️ PERBAIKAN 3: Simpan ke Supabase saat Cron Job berjalan
    if (freshPosts && freshPosts.length > 0) {
      await saveToSupabase(freshPosts);
    }
    
    console.log("✅ [CRON JOB] Scraping harian selesai & data tersimpan di Supabase.");
  } catch (err) {
    console.error("❌ [CRON JOB] Scraping harian gagal:", err.message);
  }
});

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📌 Endpoint Frontend (Supabase): GET http://localhost:${PORT}/api/instagram`);
  console.log(`📌 Endpoint Trigger Scraping: GET http://localhost:${PORT}/api/instagram/scrape`);
  console.log(`=================================`);
});