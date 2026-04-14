import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

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

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const days = parseDays();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const numericFilters = `created_at_i>${since}`;

  console.log(`Scraping Show HN posts from the last ${days} day(s)...`);

  let page = 0;
  let totalUpserted = 0;
  const dailyCounts: Record<string, number> = {};

  while (true) {
    const data = await fetchPage(page, numericFilters);
    if (data.hits.length === 0) break;

    for (const hit of data.hits) {
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
      totalUpserted++;
    }

    page++;
    if (page >= data.nbPages) break;
  }

  console.log(`\nTotal posts upserted: ${totalUpserted}`);
  console.log("\nDaily summary:");
  for (const [day, count] of Object.entries(dailyCounts).sort()) {
    console.log(`  ${day}: ${count} posts`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
