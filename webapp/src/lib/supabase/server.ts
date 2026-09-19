import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Server-side Supabase client for RSC + server actions + route handlers.
 * Reads + writes the auth cookies through Next's cookie store so the session
 * survives across requests.
 *
 * NOTE: this must NOT be called from a client component — `cookies()` is
 * server-only. Client components use ./client instead.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `cookies().set` throws inside Server Components — that's fine,
            // the middleware handles session refresh on its own path.
          }
        },
      },
    },
  );
}
