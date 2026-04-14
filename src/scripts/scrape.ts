import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { reviewPost } from "../lib/ai";

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
  page: number;
}

function parseDays(): number {
  const idx = process.argv.indexOf("--days");
  if (idx !== -1 && process.argv[idx + 1]) {
    return parseInt(process.argv[idx + 1], 10);
  }
  return 7;
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

/** Fetch all hits for a single day, then batch-upsert them. */
async function scrapeDay(
  prisma: PrismaClient,
  dayStart: number,
  dayEnd: number,
  dayLabel: string,
): Promise<{ count: number; dailyCounts: Record<string, number> }> {
  log(`Scraping day ${dayLabel}`);

  const numericFilters = `created_at_i>${dayStart},created_at_i<${dayEnd}`;
  let page = 0;
  const allHits: HnHit[] = [];

  while (true) {
    log(`  Fetching page ${page + 1} for ${dayLabel}`);
    const data = await fetchPage(page, numericFilters);
    if (data.hits.length === 0) break;
    allHits.push(...data.hits);

    page++;
    if (page >= data.nbPages) break;
  }

  const dailyCounts: Record<string, number> = {};
  for (const hit of allHits) {
    const postedAt = new Date(hit.created_at);
    const dayKey = postedAt.toISOString().slice(0, 10);
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

    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
  }

  log(`  ${dayLabel}: ${allHits.length} posts (${page} page(s))`);
  return { count: allHits.length, dailyCounts };
}

async function main() {
  // Clear log file at start
  fs.writeFileSync(LOG_FILE, "");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const days = parseDays();
  const now = Math.floor(Date.now() / 1000);

  console.log(`Scraping Show HN posts from the last ${days} day(s)...`);
  log(`Starting CLI scrape for ${days} day(s)`);

  let totalUpserted = 0;
  const allDailyCounts: Record<string, number> = {};

  // Build list of days (oldest first)
  const dayEntries: { dayStart: number; dayEnd: number; dayLabel: string }[] = [];
  for (let dayIndex = days - 1; dayIndex >= 0; dayIndex--) {
    const dayStart = now - (dayIndex + 1) * 86400;
    const dayEnd = now - dayIndex * 86400;
    const dayLabel = new Date(dayStart * 1000).toISOString().slice(0, 10);
    dayEntries.push({ dayStart, dayEnd, dayLabel });
  }

  // Process days in batches of BATCH_SIZE concurrently
  for (let i = 0; i < dayEntries.length; i += BATCH_SIZE) {
    const batch = dayEntries.slice(i, i + BATCH_SIZE);
    const batchLabels = batch.map((d) => d.dayLabel).join(", ");
    console.log(`Scraping batch: ${batchLabels}...`);

    const results = await Promise.all(
      batch.map((entry) =>
        scrapeDay(prisma, entry.dayStart, entry.dayEnd, entry.dayLabel)
      )
    );

    for (const result of results) {
      totalUpserted += result.count;
      for (const [day, count] of Object.entries(result.dailyCounts)) {
        allDailyCounts[day] = (allDailyCounts[day] || 0) + count;
      }
    }
  }

  console.log(`\nTotal posts upserted: ${totalUpserted}`);
  console.log("\nDaily summary:");
  for (const [day, count] of Object.entries(allDailyCounts).sort()) {
    console.log(`  ${day}: ${count} posts`);
  }

  // AI review for posts without scores
  const unscored = await prisma.showHnPost.findMany({
    where: { aiScore: null },
    orderBy: { postedAt: "desc" },
    take: 50,
  });

  if (unscored.length > 0) {
    console.log(`\nReviewing ${unscored.length} posts with AI...`);
    log(`Reviewing ${unscored.length} posts with AI`);

    const AI_BATCH = 10;
    let reviewed = 0;
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
          reviewed++;
          console.log(`  [${reviewed}/${unscored.length}] ${post.title} → ${review.score}/100`);
          log(`  Reviewed: ${post.title} → ${review.score}/100`);
        }
      }
    }
    console.log(`AI review complete: ${reviewed} posts scored.`);
  }

  log(`Scrape complete. Total: ${totalUpserted}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
