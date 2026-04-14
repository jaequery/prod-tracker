import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const LOG_FILE = path.resolve(process.cwd(), "scrape.log");

function log(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

interface HnHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  created_at: string;
}

interface HnResponse {
  hits: HnHit[];
  nbPages: number;
  hitsPerPage: number;
  page: number;
}

function extractSummary(title: string): string {
  const match = title.match(/^Show HN:\s*(.*)/i);
  return match ? match[1].trim() : title;
}

async function fetchPage(page: number, numericFilters: string): Promise<HnResponse> {
  const url = `http://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=100&page=${page}&numericFilters=${encodeURIComponent(numericFilters)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<HnResponse>;
}

export type ProgressCallback = (done: number, total: number, message: string) => void;

export async function scrape(
  days: number,
  onProgress?: ProgressCallback
): Promise<number> {
  // Clear log file at start of each run
  fs.writeFileSync(LOG_FILE, "");
  log(`Starting scrape for ${days} day(s)`);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const now = Math.floor(Date.now() / 1000);
    let totalUpserted = 0;

    onProgress?.(0, days, "Starting...");

    // Iterate from oldest day to newest
    for (let dayIndex = days - 1; dayIndex >= 0; dayIndex--) {
      const dayStart = now - (dayIndex + 1) * 86400;
      const dayEnd = now - dayIndex * 86400;
      const dayLabel = new Date(dayStart * 1000).toISOString().slice(0, 10);
      const daysCompleted = days - 1 - dayIndex;

      log(`Scraping day ${dayLabel} (${daysCompleted + 1}/${days})`);
      onProgress?.(daysCompleted, days, `Scraping ${dayLabel}...`);

      const numericFilters = `created_at_i>${dayStart},created_at_i<${dayEnd}`;
      let page = 0;
      let dayCount = 0;

      while (true) {
        log(`  Fetching page ${page + 1} for ${dayLabel}`);
        let data: HnResponse;
        try {
          data = await fetchPage(page, numericFilters);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log(`  Error fetching page ${page + 1} for ${dayLabel}: ${msg}`);
          throw err;
        }

        if (data.hits.length === 0) break;

        for (const hit of data.hits) {
          const postedAt = new Date(hit.created_at);
          const hnItemUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;

          await prisma.showHnPost.upsert({
            where: { hnId: hit.objectID },
            update: {
              title: hit.title,
              summary: extractSummary(hit.title),
              url: hit.url || hnItemUrl,
              numComments: hit.num_comments ?? 0,
              upvotes: hit.points ?? 0,
              postedAt,
            },
            create: {
              hnId: hit.objectID,
              title: hit.title,
              summary: extractSummary(hit.title),
              url: hit.url || hnItemUrl,
              numComments: hit.num_comments ?? 0,
              upvotes: hit.points ?? 0,
              postedAt,
            },
          });

          dayCount++;
          totalUpserted++;
        }

        page++;
        if (page >= data.nbPages) break;
      }

      log(`  ${dayLabel}: ${dayCount} posts (${page} page(s))`);
    }

    log(`Scrape complete. Total posts upserted: ${totalUpserted}`);
    onProgress?.(days, days, `Done. ${totalUpserted} posts upserted.`);
    return totalUpserted;
  } finally {
    await prisma.$disconnect();
  }
}
