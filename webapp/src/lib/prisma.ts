import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Neon's serverless driver uses a WebSocket to reach the DB from serverless
// runtimes. In Node we need the `ws` polyfill; the browser has it built-in.
neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;

function makeClient() {
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example → .env.local and paste the Neon connection string.",
    );
  }
  // Prisma adapter v7: pass a PoolConfig directly; the adapter manages the pool.
  const adapter = new PrismaNeon({ connectionString: url });
  return new PrismaClient({ adapter });
}

// Cache the client on the global object in dev so hot reload doesn't leak
// connections. In production the module scope caches naturally.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
