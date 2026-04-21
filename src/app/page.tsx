import { prisma } from "@/lib/prisma";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const [posts, ratings] = await Promise.all([
    prisma.showHnPost.findMany({ orderBy: { postedAt: "desc" } }),
    prisma.userRating.findMany({
      select: { postId: true, value: true, reason: true },
    }),
  ]);

  const serialized = posts.map((p) => ({
    ...p,
    postedAt: p.postedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return <Dashboard posts={serialized} ratings={ratings} />;
}
