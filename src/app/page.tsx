import { prisma } from "@/lib/prisma";
import PostsTable from "@/components/PostsTable";

export default async function Home() {
  const posts = await prisma.showHnPost.findMany({
    orderBy: { postedAt: "desc" },
  });

  const serialized = posts.map((p) => ({
    ...p,
    postedAt: p.postedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Show HN Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {posts.length} posts tracked
          </p>
        </header>
        {posts.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">No posts yet.</p>
        ) : (
          <PostsTable posts={serialized} />
        )}
      </div>
    </div>
  );
}
