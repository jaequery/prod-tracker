import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { reviewPost, type Exemplar } from "@/lib/ai";

export const reviewUnscored = inngest.createFunction(
  {
    id: "review-unscored-posts",
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: "posts/review.requested" }],
  },
  async ({ step }) => {
    const posts = await step.run("fetch-unscored", async () => {
      const rows = await prisma.showHnPost.findMany({
        where: { aiScore: null },
        orderBy: { postedAt: "desc" },
        select: { id: true, title: true, url: true },
      });
      return rows;
    });

    if (posts.length === 0) {
      return { reviewed: 0 };
    }

    const exemplars = await step.run("fetch-exemplars", async () => {
      const rows = await prisma.userRating.findMany({
        where: { reason: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          value: true,
          reason: true,
          post: { select: { title: true } },
        },
      });
      return rows
        .filter((r) => r.reason && (r.value === 1 || r.value === -1))
        .map<Exemplar>((r) => ({
          title: r.post.title,
          value: r.value as 1 | -1,
          reason: r.reason as string,
        }));
    });

    const BATCH = 10;
    let reviewed = 0;

    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH);
      const batchIndex = Math.floor(i / BATCH);

      const count = await step.run(
        `review-batch-${batchIndex}`,
        async () => {
          const results = await Promise.all(
            batch.map(async (post) => {
              const review = await reviewPost(post.title, post.url, exemplars);
              return { post, review };
            })
          );

          let batchReviewed = 0;
          for (const { post, review } of results) {
            if (review) {
              await prisma.showHnPost.update({
                where: { id: post.id },
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
              batchReviewed++;
            }
          }
          return batchReviewed;
        }
      );

      reviewed += count;
    }

    return { total: posts.length, reviewed };
  }
);
