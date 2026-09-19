const express = require("express");
const fs = require("fs").promises; // Gunakan versi async/promises
const { existsSync } = require("fs");
const cron = require("node-cron");
const cors = require("cors");
const { fork } = require("child_process");
const path = require("path");
const { filePath } = require("./scraper");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
let isScraping = false;

// Function penolong untuk menjalankan scraping di Child Process terpisah
const runScraperInChildProcess = () => {
  return new Promise((resolve, reject) => {
    if (isScraping) {
      return reject(new Error("Proses scraping sedang berjalan!"));
    }

    isScraping = true;
    console.log("🔄 Memulai scraping di child process...");

    // Jalankan file scraper terpisah agar tidak memblokir Event Loop utama
    const child = fork(path.join(__dirname, "run-scraper.js"));

    child.on("message", (message) => {
      if (message.status === "success") {
        isScraping = false;
        resolve(message.data);
      } else {
        isScraping = false;
        reject(new Error(message.error));
      }
    });

    child.on("error", (err) => {
      isScraping = false;
      reject(err);
    });

    child.on("exit", (code) => {
      isScraping = false;
      if (code !== 0) {
        reject(new Error(`Child process berhenti dengan code ${code}`));
      }
    });
  });
};

// ⏰ Jadwal Cron: Berjalan otomatis setiap 5 jam sekali
cron.schedule("0 */5 * * *", async () => {
  console.log("⏰ [CRON JOB] Menjalankan update otomatis 5 jam sekali...");
  try {
    await runScraperInChildProcess();
    console.log("✅ Cron scraping selesai!");
  } catch (err) {
    console.error("Gagal melakukan cron scraping:", err.message);
  }
});

// --- ENDPOINT API ---

// 1. Endpoint Non-Blocking untuk membaca JSON
app.get("/api/posts", async (req, res) => {
  try {
    if (!existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File JSON belum ada. Silakan akses /api/force-scrape."
      });
    }

    // Gunakan fs.promises.readFile (Async)
    const rawData = await fs.readFile(filePath, "utf8");
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

// 2. Endpoint manual force-scrape
app.get("/api/force-scrape", async (req, res) => {
  try {
    await runScraperInChildProcess();
    res.json({ success: true, message: "Scraping manual berhasil!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);

  if (!existsSync(filePath)) {
    console.log("📁 File JSON belum ditemukan, melakukan initial scraping...");
    try {
      await runScraperInChildProcess();
    } catch (err) {
      console.error("Initial scraping gagal:", err.message);
    }
  }
});