import { defineConfig } from "prisma/config";
import "dotenv/config";

// Prisma 7 config. Migrations need a *direct* Neon connection (pooled ones
// don't accept some DDL). Runtime queries go through the PrismaNeon adapter
// with the pooled URL — see src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
