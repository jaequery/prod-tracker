/**
 * Re-run AI review on existing posts (overwrites aiScore, aiSummary,
 * category, and aiScoreDetails). Use after tuning the scoring prompt.
 *
 * Run:   npx tsx src/scripts/rescore.ts             # rescore all
 *        npx tsx src/scripts/rescore.ts --only-scored
 *        npx tsx src/scripts/rescore.ts --days 30
 *        pnpm rescore:prod                          # against .env.prod
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { reviewPost, type Exemplar } from "../lib/ai";

const BATCH = 10;

function parseArgs() {
  const args = process.argv.slice(2);
  const onlyScored = args.includes("--only-scored");
  const daysIdx = args.indexOf("--days");
  const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1] ?? "", 10) : NaN;
  return { onlyScored, days: Number.isFinite(days) ? days : null };
}

async function main() {
  const { onlyScored, days } = parseArgs();

  const where: Record<string, unknown> = {};
  if (onlyScored) where.aiScore = { not: null };
  if (days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where.postedAt = { gte: cutoff };
  }

  const posts = await prisma.showHnPost.findMany({
    where,
    orderBy: { postedAt: "desc" },
    select: { id: true, title: true, url: true },
  });

  console.log(
    `${posts.length} posts to rescore${days ? ` (last ${days} days)` : ""}${onlyScored ? " (scored only)" : ""}`,
  );
  if (posts.length === 0) return;

  const ratings = await prisma.userRating.findMany({
    where: { reason: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      value: true,
      reason: true,
      post: { select: { title: true } },
    },
  });
  const exemplars: Exemplar[] = ratings
    .filter((r) => r.reason && (r.value === 1 || r.value === -1))
    .map((r) => ({
      title: r.post.title,
      value: r.value as 1 | -1,
      reason: r.reason as string,
    }));
  console.log(`Using ${exemplars.length} taste exemplars`);

  let done = 0;
  let updated = 0;
  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (p) => {
        try {
          const review = await reviewPost(p.title, p.url, exemplars);
          if (!review) return;
          await prisma.showHnPost.update({
            where: { id: p.id },
            data: {
              aiSummary: review.summary,
              aiScore: review.score,
              category: review.category,
              aiScoreDetails: {
                targetAudience: review.targetAudience,
                whyItMatters: review.whyItMatters,
                vibe: review.vibe,
                techStack: review.techStack,
                category: review.category,
              },
            },
          });
          updated++;
        } catch (err) {
          console.error(`Failed for ${p.id}:`, err);
        }
      }),
    );
    done += batch.length;
    console.log(`  ${done}/${posts.length} (${updated} updated)`);
  }

  console.log(`Done. ${updated}/${posts.length} rescored.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
