import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

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
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const numericFilters = `created_at_i>${since}`;

    // Fetch first page to get total
    const firstPage = await fetchPage(0, numericFilters);
    const totalEstimate = firstPage.nbPages * (firstPage.hitsPerPage || 100);
    let done = 0;

    onProgress?.(0, totalEstimate, `Fetching page 1 of ${firstPage.nbPages}...`);

    async function processHits(hits: HnHit[]) {
      for (const hit of hits) {
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

        done++;
      }
    }

    // Process first page
    await processHits(firstPage.hits);
    onProgress?.(done, totalEstimate, `Processed page 1 of ${firstPage.nbPages}`);

    // Process remaining pages
    for (let page = 1; page < firstPage.nbPages; page++) {
      onProgress?.(done, totalEstimate, `Fetching page ${page + 1} of ${firstPage.nbPages}...`);
      const data = await fetchPage(page, numericFilters);
      if (data.hits.length === 0) break;
      await processHits(data.hits);
      onProgress?.(done, totalEstimate, `Processed page ${page + 1} of ${firstPage.nbPages}`);
    }

    onProgress?.(done, done, "Done");
    return done;
  } finally {
    await prisma.$disconnect();
  }
}
