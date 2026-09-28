const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const ENV_LENGKAP = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!ENV_LENGKAP) {
  console.warn("SUPABASE_URL atau SUPABASE_KEY belum dikonfigurasi (.env / Environment Variables Vercel)");
}

// Cegah crash saat import bila env kosong. Penyimpanan tetap akan gagal dengan pesan jelas.
const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_KEY || "placeholder-key"
);

/**
 * Menyimpan/meng-update array postingan ke tabel instagram_posts.
 * Melempar error bila gagal, supaya kegagalan tidak tersembunyi.
 * @param {Array} posts
 * @returns {Promise<Array>} data yang tersimpan
 */
async function saveToSupabase(posts) {
  if (!ENV_LENGKAP) {
    throw new Error("Konfigurasi Supabase kosong: isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    console.log("Tidak ada data postingan untuk disimpan ke Supabase.");
    return [];
  }

  const payload = posts
    .filter((post) => post && post.id)
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
    throw new Error("Semua data postingan tidak valid (ID kosong). Batal menyimpan.");
  }

  const { data, error } = await supabase
    .from("instagram_posts")
    .upsert(payload, { onConflict: "id" })
    .select();

  if (error) {
    console.error("Supabase upsert error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw new Error(`Supabase upsert gagal: ${error.message}`);
  }

  console.log(`Berhasil: ${data?.length ?? payload.length} data tersimpan/di-update di Supabase.`);
  return data;
}

module.exports = { supabase, saveToSupabase };