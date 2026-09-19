const { scrapeInstagram } = require("./scraper");

(async () => {
  try {
    const result = await scrapeInstagram();
    process.send({ status: "success", data: result });
    process.exit(0);
  } catch (error) {
    process.send({ status: "error", error: error.message });
    process.exit(1);
  }
})();