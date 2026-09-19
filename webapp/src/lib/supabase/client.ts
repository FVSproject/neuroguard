"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Browser-side Supabase client. Reads session from `sb-*` cookies that the
 * middleware in src/middleware.ts refreshes on every request.
 *
 * Only use this from client components ("use client"). Server components +
 * server actions should import from ./server.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
