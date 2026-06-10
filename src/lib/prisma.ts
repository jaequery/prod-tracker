import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Create a fresh Prisma client per request.
//
// On Cloudflare Workers a module-level singleton breaks: `process.env` is only
// populated per request (not at module-eval time), and a DB connection opened
// in one request may not be reused by another. `maxUses: 1` ensures pooled
// connections are never carried across requests.
//
// Call this once at the top of each request handler / Inngest function and
// reuse the returned client within that invocation.
export function getPrisma() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    maxUses: 1,
  });
  return new PrismaClient({ adapter });
}
