import { prisma } from "@/lib/prisma";
import Dashboard from "@/components/Dashboard";

export default async function Home() {
  const posts = await prisma.showHnPost.findMany({
    orderBy: { postedAt: "desc" },
  });

  const serialized = posts.map((p) => ({
    ...p,
    postedAt: p.postedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return <Dashboard posts={serialized} />;
}
