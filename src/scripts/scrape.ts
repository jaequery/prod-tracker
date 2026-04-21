import "dotenv/config";
import { scrape } from "@/lib/scraper";

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

  const days = parseDays();
  console.log(`Scraping Show HN posts from the last ${days} day(s)...`);

  const total = await scrape(days);
  console.log(`\nTotal posts upserted: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
