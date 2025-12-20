import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "adapters/express": "src/adapters/express.ts",
    "adapters/hono": "src/adapters/hono.ts",
    "drivers/index": "src/drivers/index.ts",
    "drivers/prisma": "src/drivers/prisma.ts",
    "plugins/index": "src/plugins/index.ts",
    "plugins/auth/index": "src/plugins/auth/index.ts",
    "plugins/timestamps": "src/plugins/timestamps.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: [
    "express",
    "hono",
    "@prisma/client",
    "better-auth",
    "better-auth/plugins",
    "better-auth/adapters/prisma",
  ],
})
