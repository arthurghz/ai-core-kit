// Layout for the PROTECTED (dashboard) route group of ${project.name}.
//
// middleware.ts already gates this route group (Clerk auth: ${auth.provider}).
// As a defense-in-depth check we also read auth() here and redirect unauthenticated
// users to sign-in. Shared dashboard chrome (nav, sidebar) goes here.
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  return <section>{children}</section>;
}
