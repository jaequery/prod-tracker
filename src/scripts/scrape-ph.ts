import "dotenv/config";
import { isProductHuntEnabled, scrapeProductHunt } from "@/lib/producthunt";

function parseDays(): number {
  const idx = process.argv.indexOf("--days");
  if (idx !== -1 && process.argv[idx + 1]) {
    return parseInt(process.argv[idx + 1], 10);
  }
  return 7;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!isProductHuntEnabled()) {
    console.log("PRODUCT_HUNT_TOKEN is not set — nothing to do.");
    return;
  }

  const days = parseDays();
  console.log(`Scraping Product Hunt launches from the last ${days} day(s)...`);

  const total = await scrapeProductHunt(days);
  console.log(`\nTotal Product Hunt posts upserted: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
