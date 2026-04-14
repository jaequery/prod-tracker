import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { reviewPost } from "./ai";

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

const BATCH_SIZE = 5;

export type ProgressCallback = (done: number, total: number, message: string) => void;

/** Fetch all hits for a single day, then batch-upsert them. */
async function scrapeDay(
  prisma: PrismaClient,
  dayStart: number,
  dayEnd: number,
  dayLabel: string,
): Promise<number> {
  log(`Scraping day ${dayLabel}`);

  const numericFilters = `created_at_i>${dayStart},created_at_i<${dayEnd}`;
  let page = 0;
  const allHits: HnHit[] = [];

  // Collect all hits for this day
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
    allHits.push(...data.hits);

    page++;
    if (page >= data.nbPages) break;
  }

  // Batch upsert all hits for this day
  for (const hit of allHits) {
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
  }

  log(`  ${dayLabel}: ${allHits.length} posts (${page} page(s))`);
  return allHits.length;
}

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

    // Build list of days (oldest first)
    const dayEntries: { dayStart: number; dayEnd: number; dayLabel: string }[] = [];
    for (let dayIndex = days - 1; dayIndex >= 0; dayIndex--) {
      const dayStart = now - (dayIndex + 1) * 86400;
      const dayEnd = now - dayIndex * 86400;
      const dayLabel = new Date(dayStart * 1000).toISOString().slice(0, 10);
      dayEntries.push({ dayStart, dayEnd, dayLabel });
    }

    // Process days in batches of BATCH_SIZE concurrently
    let daysCompleted = 0;
    for (let i = 0; i < dayEntries.length; i += BATCH_SIZE) {
      const batch = dayEntries.slice(i, i + BATCH_SIZE);
      const batchLabels = batch.map((d) => d.dayLabel).join(", ");

      onProgress?.(daysCompleted, days, `Scraping batch: ${batchLabels}...`);

      const results = await Promise.all(
        batch.map((entry) =>
          scrapeDay(prisma, entry.dayStart, entry.dayEnd, entry.dayLabel)
        )
      );

      for (const count of results) {
        totalUpserted += count;
      }

      daysCompleted += batch.length;
    }

    log(`Scrape complete. Total posts upserted: ${totalUpserted}`);

    // AI review for posts that don't have scores yet
    const unscored = await prisma.showHnPost.findMany({
      where: { aiScore: null },
      orderBy: { postedAt: "desc" },
      take: 50,
    });

    if (unscored.length > 0) {
      log(`Reviewing ${unscored.length} posts with AI...`);
      onProgress?.(days, days, `Reviewing ${unscored.length} posts with AI...`);

      const AI_BATCH = 10;
      for (let i = 0; i < unscored.length; i += AI_BATCH) {
        const batch = unscored.slice(i, i + AI_BATCH);
        const results = await Promise.all(
          batch.map(async (post) => {
            const review = await reviewPost(post.title, post.url);
            return { post, review };
          })
        );
        for (const { post, review } of results) {
          if (review) {
            await prisma.showHnPost.update({
              where: { id: post.id },
              data: {
                aiSummary: review.summary,
                aiScore: review.score,
                aiScoreDetails: JSON.parse(JSON.stringify({ targetAudience: review.targetAudience, dimensions: review.dimensions })),
              },
            });
            log(`  Reviewed: ${post.title} → ${review.score}/100`);
          }
        }
      }
    }

    onProgress?.(days, days, `Done. ${totalUpserted} posts upserted.`);
    return totalUpserted;
  } finally {
    await prisma.$disconnect();
  }
}
