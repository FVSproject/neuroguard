import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything under (app) requires sign-in. Public: landing page, sign-in/up,
// favicons, and Next.js internals.
const isProtected = createRouteMatcher([
  "/live(.*)",
  "/profile(.*)",
  "/logs(.*)",
  "/reports(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals + static files (unless requested explicitly)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run middleware on API + tRPC
    "/(api|trpc)(.*)",
  ],
};
