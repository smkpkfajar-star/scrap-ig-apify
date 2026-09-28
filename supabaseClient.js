const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("⚠️ SUPABASE_URL atau SUPABASE_KEY belum dikonfigurasi di file .env");
}

// 🛠️ PERBAIKAN 1: Cegah crash app jika env URL/KEY kosong
const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co", 
  SUPABASE_KEY || "placeholder-key"
);

/**
 * Menyimpan/meng-update array postingan ke Supabase
 * @param {Array} posts 
 * @returns {Promise<Array|null>} Array data yang tersimpan atau null jika gagal
 */
async function saveToSupabase(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    console.log("ℹ️ Tidak ada data postingan untuk disimpan ke Supabase.");
    return [];
  }

  // 🛠️ DEBUG LOG 1: Cek sampel data masuk
  console.log(`🔍 Memproses ${posts.length} postingan... Contoh ID pertama:`, posts[0]?.id);

  try {
    const payload = posts
      .filter((post) => post && post.id) // Filter hanya postingan yang punya ID valid
      .map((post) => {
        // Format tanggal secara aman
        let postedAt = post.timestamp;
        if (postedAt && !isNaN(new Date(postedAt).getTime())) {
          postedAt = new Date(postedAt).toISOString();
        } else {
          postedAt = new Date().toISOString();
        }

        return {
          id: String(post.id),
          type: post.type || "image",
          caption: post.caption || "",
          thumbnail_url: post.thumbnailUrl || post.displayUrl || null,
          is_video: Boolean(post.isVideo),
          video_url: post.videoUrl || null,
          likes_count: Number(post.likesCount) || 0,
          comments_count: Number(post.commentsCount) || 0,
          post_url: post.postUrl || post.url || null,
          posted_at: postedAt,
          updated_at: new Date().toISOString()
        };
      });

    if (payload.length === 0) {
      console.warn("⚠️ Semua data postingan tidak valid (ID kosong). Batal menyimpan.");
      return [];
    }

    // Eksekusi upsert dengan select() untuk melihat data yang tersimpan
    const { data, error } = await supabase
      .from("instagram_posts")
      .upsert(payload, { onConflict: "id" })
      .select();

    if (error) {
      console.error("❌ Supabase Upsert Error Detail:");
      console.error(" - Code   :", error.code);
      console.error(" - Message:", error.message);
      console.error(" - Details:", error.details);
      console.error(" - Hint   :", error.hint);
      return null;
    } 

    console.log(`🚀 BERHASIL! ${data?.length || payload.length} data tersimpan/di-update di Supabase.`);
    
    // 🛠️ PERBAIKAN 2: Return data agar bisa dimanfaatkan oleh pemanggil fungsi
    return data;

  } catch (err) {
    console.error("❌ Unexpected Error saat menyimpan ke Supabase:", err.message);
    return null;
  }
}

module.exports = { supabase, saveToSupabase };