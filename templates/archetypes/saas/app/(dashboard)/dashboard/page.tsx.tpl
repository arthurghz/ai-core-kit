// Protected dashboard home for ${project.name}.
//
// Reached only when authenticated (middleware + the group layout both gate it).
// This is the first authenticated screen; build the core product surface here per
// specs/PLAN.md (the thinnest vertical slice) and specs/DESIGN.md (key screens).
import { currentUser } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const user = await currentUser();
  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as {user?.primaryEmailAddress?.emailAddress ?? user?.id}</p>
      {/* TODO(product): the first vertical slice from specs/PLAN.md lands here. */}
    </main>
  );
}
