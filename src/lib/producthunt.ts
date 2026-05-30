import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  buildDayEntries,
  triggerPostProcessing,
  type DayEntry,
  type ProgressCallback,
} from "./scraper";

const PH_API = "https://api.producthunt.com/v2/api/graphql";
const PAGE_SIZE = 50;

/** Discriminator stored in ShowHnPost.source for Product Hunt launches. */
export const PH_SOURCE = "product_hunt";

/** Product Hunt ingest only runs when a developer token is configured. */
export function isProductHuntEnabled(): boolean {
  return Boolean(process.env.PRODUCT_HUNT_TOKEN);
}

interface PhPostNode {
  id: string;
  name: string;
  tagline: string | null;
  votesCount: number | null;
  commentsCount: number | null;
  createdAt: string;
  featuredAt: string | null;
  url: string;
}

interface PhPostsResponse {
  data?: {
    posts: {
      edges: { node: PhPostNode }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: { message: string }[];
}

const POSTS_QUERY = `
query Posts($after: String, $postedAfter: DateTime, $postedBefore: DateTime, $first: Int!) {
  posts(after: $after, postedAfter: $postedAfter, postedBefore: $postedBefore, first: $first) {
    edges {
      node {
        id
        name
        tagline
        votesCount
        commentsCount
        createdAt
        featuredAt
        url
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

async function phRequest(
  variables: Record<string, unknown>,
): Promise<PhPostsResponse> {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) throw new Error("PRODUCT_HUNT_TOKEN is not set");

  const res = await fetch(PH_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: POSTS_QUERY, variables }),
  });
  if (!res.ok) throw new Error(`Product Hunt HTTP ${res.status}`);

  const json = (await res.json()) as PhPostsResponse;
  if (json.errors?.length) {
    throw new Error(
      `Product Hunt GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return json;
}

/** Fetch all Product Hunt launches for a single day, then upsert them. */
export async function scrapePhDay(
  prisma: PrismaClient,
  entry: DayEntry,
): Promise<number> {
  const { dayStart, dayEnd, dayLabel } = entry;
  const postedAfter = new Date(dayStart * 1000).toISOString();
  const postedBefore = new Date(dayEnd * 1000).toISOString();

  const nodes: PhPostNode[] = [];
  let after: string | null = null;
  let pages = 0;

  while (true) {
    const json = await phRequest({
      after,
      postedAfter,
      postedBefore,
      first: PAGE_SIZE,
    });
    const conn = json.data?.posts;
    if (!conn) break;
    nodes.push(...conn.edges.map((e) => e.node));
    pages++;
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }

  for (const node of nodes) {
    const postedAt = new Date(node.featuredAt || node.createdAt);
    const data = {
      title: node.name,
      summary: node.tagline?.trim() || node.name,
      url: node.url,
      numComments: node.commentsCount ?? 0,
      upvotes: node.votesCount ?? 0,
      postedAt,
      source: PH_SOURCE,
    };

    await prisma.showHnPost.upsert({
      where: { hnId: `ph_${node.id}` },
      update: data,
      create: { hnId: `ph_${node.id}`, ...data },
    });
  }

  console.log(`  [PH] ${dayLabel}: ${nodes.length} launches (${pages} page(s))`);
  return nodes.length;
}

/** Top-level Product Hunt scrape entry point for the CLI. No-op without a token. */
export async function scrapeProductHunt(
  days: number,
  onProgress?: ProgressCallback,
): Promise<number> {
  if (!isProductHuntEnabled()) {
    console.log("PRODUCT_HUNT_TOKEN not set — skipping Product Hunt ingest.");
    return 0;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const entries = buildDayEntries(days);
    let total = 0;
    let daysCompleted = 0;

    onProgress?.(0, days, "Starting Product Hunt...");

    for (const entry of entries) {
      onProgress?.(daysCompleted, days, `Product Hunt: ${entry.dayLabel}...`);
      console.log(`Scraping Product Hunt: ${entry.dayLabel}...`);
      total += await scrapePhDay(prisma, entry);
      daysCompleted++;
    }

    const { unscored, missingPreviews } = await triggerPostProcessing(prisma);
    if (unscored > 0) {
      console.log(`${unscored} unscored posts queued for AI review.`);
    }
    if (missingPreviews > 0) {
      console.log(`${missingPreviews} posts queued for preview fetch.`);
    }

    onProgress?.(days, days, `Done. ${total} Product Hunt launches upserted.`);
    return total;
  } finally {
    await prisma.$disconnect();
  }
}
