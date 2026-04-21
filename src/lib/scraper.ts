import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { inngest } from "./inngest";

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

export interface DayEntry {
  dayStart: number;
  dayEnd: number;
  dayLabel: string;
}

export function buildDayEntries(days: number): DayEntry[] {
  const now = Math.floor(Date.now() / 1000);
  const entries: DayEntry[] = [];
  for (let dayIndex = days - 1; dayIndex >= 0; dayIndex--) {
    const dayStart = now - (dayIndex + 1) * 86400;
    const dayEnd = now - dayIndex * 86400;
    const dayLabel = new Date(dayStart * 1000).toISOString().slice(0, 10);
    entries.push({ dayStart, dayEnd, dayLabel });
  }
  return entries;
}

/** Fetch all hits for a single day, then upsert them. */
export async function scrapeDay(
  prisma: PrismaClient,
  entry: DayEntry,
): Promise<number> {
  const { dayStart, dayEnd, dayLabel } = entry;
  const numericFilters = `created_at_i>${dayStart},created_at_i<${dayEnd}`;
  let page = 0;
  const allHits: HnHit[] = [];

  while (true) {
    const data = await fetchPage(page, numericFilters);
    if (data.hits.length === 0) break;
    allHits.push(...data.hits);

    page++;
    if (page >= data.nbPages) break;
  }

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

  console.log(`  ${dayLabel}: ${allHits.length} posts (${page} page(s))`);
  return allHits.length;
}

/** After a scrape, dispatch Inngest events for any unscored/preview-missing posts. */
export async function triggerPostProcessing(prisma: PrismaClient): Promise<{
  unscored: number;
  missingPreviews: number;
}> {
  const [unscored, missingPreviews] = await Promise.all([
    prisma.showHnPost.count({ where: { aiScore: null } }),
    prisma.showHnPost.count({ where: { previewFetchedAt: null } }),
  ]);

  if (unscored > 0) {
    await inngest.send({ name: "posts/review.requested", data: {} });
  }
  if (missingPreviews > 0) {
    await inngest.send({ name: "posts/preview.requested", data: {} });
  }

  return { unscored, missingPreviews };
}

/** Top-level scrape entry point for the CLI. */
export async function scrape(
  days: number,
  onProgress?: ProgressCallback,
): Promise<number> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const dayEntries = buildDayEntries(days);
    let totalUpserted = 0;

    onProgress?.(0, days, "Starting...");

    let daysCompleted = 0;
    for (let i = 0; i < dayEntries.length; i += BATCH_SIZE) {
      const batch = dayEntries.slice(i, i + BATCH_SIZE);
      const batchLabels = batch.map((d) => d.dayLabel).join(", ");

      onProgress?.(daysCompleted, days, `Scraping batch: ${batchLabels}...`);
      console.log(`Scraping batch: ${batchLabels}...`);

      const results = await Promise.all(batch.map((entry) => scrapeDay(prisma, entry)));
      for (const count of results) totalUpserted += count;

      daysCompleted += batch.length;
    }

    const { unscored, missingPreviews } = await triggerPostProcessing(prisma);
    if (unscored > 0) {
      onProgress?.(days, days, `${unscored} posts queued for AI review...`);
      console.log(`${unscored} unscored posts queued for AI review.`);
    }
    if (missingPreviews > 0) {
      console.log(`${missingPreviews} posts queued for preview fetch.`);
    }

    onProgress?.(days, days, `Done. ${totalUpserted} posts upserted.`);
    return totalUpserted;
  } finally {
    await prisma.$disconnect();
  }
}
