// Auth helpers for ${project.name} (provider: ${auth.provider}).
//
// ALWAYS PRESENT in this archetype. Thin wrappers over Clerk's server helpers so
// the rest of the app imports auth from one place (swap the implementation here if
// you change provider). Use requireUserId() in server actions / route handlers that
// must be authenticated; middleware.ts is the first line of defense for pages.
import { auth, currentUser } from "@clerk/nextjs/server";

export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }
  return userId;
}

export { currentUser };
