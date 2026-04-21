import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [total, unscored] = await Promise.all([
    prisma.showHnPost.count(),
    prisma.showHnPost.count({ where: { aiScore: null } }),
  ]);

  const reviewed = total - unscored;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  console.log(`Total:    ${total}`);
  console.log(`Reviewed: ${reviewed}`);
  console.log(`Pending:  ${unscored}`);
  console.log(`Progress: ${pct}%`);

  if (unscored === 0) {
    console.log("\nAll posts reviewed!");
  }

  await prisma.$disconnect();
}

main();
