/**
 * Backfill the new `category` column for existing scored posts.
 * Cheap classify-only prompt; runs concurrently in batches.
 *
 * Run: npx tsx src/scripts/backfill-categories.ts
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { CATEGORIES, type Category } from "../lib/ai";

const BATCH = 10;

async function classify(title: string, url: string): Promise<Category | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const prompt = `Classify this Show HN project into EXACTLY ONE category.

Title: ${title}
URL: ${url}

Categories (pick ONE, return only the slug):
- startup: commercial product, SaaS, paid service, anything pursuing revenue
- open-source: library, framework, SDK, OSS package meant to be imported by other devs
- dev-tool: CLI, IDE plugin, dev workflow utility (not a library)
- ai-ml: AI/ML/LLM-focused product or model release (overrides startup/oss when AI is the headline)
- video-game: a game, playable interactive entertainment
- hardware: physical product, IoT, robotics, electronics
- educational: tutorial, course, interactive lesson, teaching tool
- informational: data viz, dataset, reference site, directory, dashboard about something
- research: academic paper, novel technique writeup, research preview
- content: blog post, newsletter, essay, podcast, video
- demo: showcase/experiment/art piece with no clear utility goal
- hobby: weekend hack, personal side project not aiming for users
- other: none of the above clearly fits

Respond with JUST the slug, nothing else. Example: startup`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    console.error(`OpenRouter error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content ?? "").toLowerCase().trim();
  const cleaned = raw.replace(/[^a-z-]/g, "");
  if ((CATEGORIES as readonly string[]).includes(cleaned)) return cleaned as Category;
  // Best-effort: pick first matching category substring.
  for (const c of CATEGORIES) {
    if (raw.includes(c)) return c;
  }
  return "other";
}

async function main() {
  const posts = await prisma.showHnPost.findMany({
    where: { category: null },
    orderBy: { postedAt: "desc" },
    select: { id: true, title: true, url: true },
  });

  console.log(`${posts.length} posts to classify`);
  if (posts.length === 0) return;

  let done = 0;
  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (p) => {
        try {
          const cat = await classify(p.title, p.url);
          if (cat) {
            await prisma.showHnPost.update({
              where: { id: p.id },
              data: { category: cat },
            });
          }
        } catch (err) {
          console.error(`Failed for ${p.id}:`, err);
        }
      }),
    );
    done += batch.length;
    console.log(`  ${done}/${posts.length}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
