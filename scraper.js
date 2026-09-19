const axios = require("axios");
const fs = require("fs").promises; // Gunakan Async/Promises
const { existsSync } = require("fs");
const path = require("path");
require("dotenv").config();

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const USERNAME = "smptamandewasajetisjogja";
const APIFY_URL = `https://api.apify.com/v2/acts/data-slayer~instagram-posts/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

const dataDir = path.join(__dirname, "data");
const filePath = path.join(dataDir, "instagram.json");

async function scrapeInstagram(forceRefresh = false) {
  try {
    // 1. Buat direktori jika belum ada (Async)
    if (!existsSync(dataDir)) {
      await fs.mkdir(dataDir, { recursive: true });
    }

    // 2. Cek cache lokal secara Non-Blocking
    if (!forceRefresh && existsSync(filePath)) {
      try {
        const stats = await fs.stat(filePath);
        const fileAgeInMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
        const CACHE_DURATION_MINUTES = 60;

        if (fileAgeInMinutes < CACHE_DURATION_MINUTES) {
          console.log("=================================");
          console.log(`⚡ MENGGUNAKAN CACHE LOKAL (File berumur ${fileAgeInMinutes.toFixed(1)} menit)`);
          console.log("=================================");
          
          const cachedData = await fs.readFile(filePath, "utf8");
          return JSON.parse(cachedData);
        }
      } catch (cacheError) {
        console.log("⚠️ Error membaca cache, melanjutkan ke API...");
      }
    }

    console.log("=================================");
    console.log("⏳ MULAI SCRAPING INSTAGRAM (BARU KE API)...");
    console.log("Username:", USERNAME);
    console.log("=================================");

    const response = await axios.post(
      APIFY_URL,
      {
        username: USERNAME,
        resultsLimit: 10 
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 120000
      }
    );

    const rawPosts = response.data;

    if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
      throw new Error("Response Apify bukan array atau data kosong.");
    }

    // 3. Pemetaan data
    const formattedPosts = rawPosts.map((post) => {
      let captionText = "";
      if (typeof post.caption === "string") {
        captionText = post.caption;
      } else if (post.caption && post.caption.text) {
        captionText = post.caption.text;
      }

      const isVideoPost = post.isVideo || post.is_video || post.media_type === 2 || false;
      const videoSrc = post.videoUrl || post.video_url || null;

      let imageCandidate = 
        post.thumbnailUrl || 
        post.thumbnail_url || 
        post.displayUrl || 
        post.display_url || 
        post.imageUrl || 
        post.image_url || 
        (post.image_versions && post.image_versions.items && post.image_versions.items[0] && post.image_versions.items[0].url) ||
        "";

      if (!imageCandidate && isVideoPost) {
        imageCandidate = videoSrc || "";
      }

      let postType = "Image";
      if (isVideoPost || videoSrc || post.media_type === 2) {
        postType = "Video";
      } else if (post.media_type === 8 || post.type === "Sidecar" || post.type === "GraphSidecar") {
        postType = "Carousel";
      }

      return {
        id: post.id || post.code || "",
        type: postType,
        caption: captionText,
        thumbnailUrl: imageCandidate,
        isVideo: isVideoPost,
        videoUrl: videoSrc,
        likesCount: post.likesCount || post.like_count || 0,
        commentsCount: post.commentsCount || post.comment_count || 0,
        postUrl: post.postUrl || (post.code ? `https://www.instagram.com/p/${post.code}/` : post.url || ""),
        timestamp: post.timestamp || post.taken_at_date || new Date().toISOString()
      };
    });

    // 4. Simpan file secara Async
    await fs.writeFile(filePath, JSON.stringify(formattedPosts, null, 2), "utf8");

    console.log("=================================");
    console.log("✅ BERHASIL DIPERBARUI & DISIMPAN KE FILE!");
    console.log("=================================");

    return formattedPosts;
  } catch (error) {
    console.log("=================================");
    console.log("❌ SCRAPING ERROR");
    console.log("=================================");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Response:", error.response.data);
    } else {
      console.log("Error:", error.message);
    }
    
    // Fallback cache Async
    if (existsSync(filePath)) {
      try {
        console.log("⚠️ Menggunakan data cache lama sebagai cadangan karena API error.");
        const fallbackData = await fs.readFile(filePath, "utf8");
        return JSON.parse(fallbackData);
      } catch (fallbackError) {
        console.log("❌ Gagal membaca cache fallback:", fallbackError.message);
        throw error;
      }
    }
    
    throw error;
  }
}

module.exports = { scrapeInstagram, filePath };