import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { reviewUnscored } from "@/inngest/review-posts";
import { fetchMissingPreviews } from "@/inngest/fetch-previews";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [reviewUnscored, fetchMissingPreviews],
});
