import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // OpenNext bundles the server with the "workerd" export condition, so `pg`
  // pulls in pg-cloudflare's real socket (dist/index.js). Next's file tracer
  // only copies the "default" condition (empty.js), so force-include the rest.
  outputFileTracingIncludes: {
    "*": ["node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/**/*"],
  },
};

export default nextConfig;

// Enable Cloudflare bindings (env, R2, etc.) when running `next dev`.
initOpenNextCloudflareForDev();
