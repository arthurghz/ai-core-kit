// Clerk auth middleware for ${project.name} (auth provider: ${auth.provider}).
//
// ALWAYS PRESENT in this archetype. Protects the (dashboard) route group; the
// marketing landing ("/") and Clerk's own sign-in/up routes stay public. The
// Stripe webhook is public (it is verified by signature, not by session) so it is
// excluded from the matcher below.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Run on everything except Next internals and static assets; always run on API
  // routes. (Standard Clerk matcher.)
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
