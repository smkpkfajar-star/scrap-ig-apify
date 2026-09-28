const axios = require("axios");
require("dotenv").config();

const { saveToSupabase } = require("./supabaseClient");

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const USERNAME = "smptamandewasajetisjogja";
const APIFY_URL = `https://api.apify.com/v2/acts/data-slayer~instagram-posts/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

// Ubah satu postingan mentah Apify menjadi format siap simpan
function formatPost(post) {
  // Ekstrak teks caption
  let captionText = "";
  if (typeof post.caption === "string") {
    captionText = post.caption;
  } else if (post.caption && post.caption.text) {
    captionText = post.caption.text;
  }

  const isVideoPost = post.isVideo || post.is_video || post.media_type === 2 || false;
  const videoSrc = post.videoUrl || post.video_url || null;

  // Ambil URL gambar/thumbnail terbaik
  let imageCandidate =
    post.thumbnailUrl ||
    post.thumbnail_url ||
    post.displayUrl ||
    post.display_url ||
    post.imageUrl ||
    post.image_url ||
    (post.image_versions &&
      post.image_versions.items &&
      post.image_versions.items[0] &&
      post.image_versions.items[0].url) ||
    "";

  if (!imageCandidate && isVideoPost) {
    imageCandidate = videoSrc || "";
  }

  // Penentuan tipe postingan
  let postType = "Image";
  if (isVideoPost || videoSrc || post.media_type === 2) {
    postType = "Video";
  } else if (post.media_type === 8 || post.type === "Sidecar" || post.type === "GraphSidecar") {
    postType = "Carousel";
  }

  // Timestamp aman untuk PostgreSQL
  let postTimestamp = post.timestamp || post.taken_at_date;
  if (typeof postTimestamp === "number") {
    // Detik (UNIX) dikalikan 1000 ke milidetik
    postTimestamp = new Date(postTimestamp * (postTimestamp < 10000000000 ? 1000 : 1)).toISOString();
  } else if (!postTimestamp || isNaN(new Date(postTimestamp).getTime())) {
    postTimestamp = new Date().toISOString();
  } else {
    postTimestamp = new Date(postTimestamp).toISOString();
  }

  return {
    id: String(post.id || post.code || ""),
    type: postType,
    caption: captionText,
    thumbnailUrl: imageCandidate,
    isVideo: isVideoPost,
    videoUrl: videoSrc,
    likesCount: post.likesCount || post.like_count || 0,
    commentsCount: post.commentsCount || post.comment_count || 0,
    postUrl: post.postUrl || (post.code ? `https://www.instagram.com/p/${post.code}/` : post.url || ""),
    timestamp: postTimestamp
  };
}

// Scrape Instagram lalu simpan langsung ke Supabase (tanpa file JSON)
async function scrapeInstagram() {
  console.log("=================================");
  console.log("MULAI SCRAPING INSTAGRAM...");
  console.log("Username:", USERNAME);
  console.log("=================================");

  let rawPosts;
  try {
    const response = await axios.post(
      APIFY_URL,
      { username: USERNAME, resultsLimit: 10 },
      { headers: { "Content-Type": "application/json" }, timeout: 120000 }
    );
    rawPosts = response.data;
  } catch (error) {
    if (error.response) {
      console.error("Apify error. Status:", error.response.status, "Response:", error.response.data);
    } else {
      console.error("Apify error:", error.message);
    }
    throw error;
  }

  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    throw new Error("Response Apify bukan array atau data kosong.");
  }

  // Terbaru di atas, supaya postingan yang disematkan tidak mengacaukan urutan
  const formattedPosts = rawPosts
    .map(formatPost)
    .filter((p) => p.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Langsung ke Supabase. Bila gagal, error dilempar agar terlihat (tidak disembunyikan).
  await saveToSupabase(formattedPosts);
  console.log("Tersimpan ke Supabase:", formattedPosts.length, "postingan");

  return formattedPosts;
}

module.exports = { scrapeInstagram };