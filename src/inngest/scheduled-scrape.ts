import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { buildDayEntries, scrapeDay } from "@/lib/scraper";

const DAYS = 7;

export const scheduledScrape = inngest.createFunction(
  {
    id: "scheduled-scrape",
    retries: 2,
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const entries = buildDayEntries(DAYS);

    let total = 0;
    for (const entry of entries) {
      const count = await step.run(`scrape-${entry.dayLabel}`, () =>
        scrapeDay(prisma, entry),
      );
      total += count;
    }

    const [unscored, missingPreviews] = await step.run("count-pending", async () => {
      return Promise.all([
        prisma.showHnPost.count({ where: { aiScore: null } }),
        prisma.showHnPost.count({ where: { previewFetchedAt: null } }),
      ]);
    });

    if (unscored > 0) {
      await step.sendEvent("trigger-review", {
        name: "posts/review.requested",
        data: {},
      });
    }
    if (missingPreviews > 0) {
      await step.sendEvent("trigger-previews", {
        name: "posts/preview.requested",
        data: {},
      });
    }

    return { days: entries.length, total, unscored, missingPreviews };
  },
);
