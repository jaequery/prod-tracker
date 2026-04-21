import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { fetchSiteMeta } from "@/lib/og-image";

export const fetchMissingPreviews = inngest.createFunction(
  {
    id: "fetch-missing-previews",
    concurrency: { limit: 8 },
    retries: 1,
    triggers: [{ event: "posts/preview.requested" }],
  },
  async ({ step }) => {
    const posts = await step.run("fetch-missing", async () => {
      return prisma.showHnPost.findMany({
        where: { previewFetchedAt: null },
        orderBy: { postedAt: "desc" },
        select: { id: true, url: true },
      });
    });

    if (posts.length === 0) return { fetched: 0 };

    const BATCH = 10;
    let fetched = 0;

    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH);
      const batchIndex = Math.floor(i / BATCH);

      const count = await step.run(
        `preview-batch-${batchIndex}`,
        async () => {
          const results = await Promise.all(
            batch.map(async (post) => {
              const meta = await fetchSiteMeta(post.url);
              return { post, meta };
            }),
          );

          let batchFetched = 0;
          for (const { post, meta } of results) {
            await prisma.showHnPost.update({
              where: { id: post.id },
              data: {
                previewImage: meta.image,
                siteDescription: meta.description,
                previewFetchedAt: new Date(),
              },
            });
            if (meta.image) batchFetched++;
          }
          return batchFetched;
        },
      );

      fetched += count;
    }

    return { total: posts.length, fetched };
  },
);
