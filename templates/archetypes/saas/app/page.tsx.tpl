// Marketing / landing route for ${project.name} (PUBLIC).
//
// This is the unauthenticated entry point. Clerk middleware leaves "/" public
// (only the (dashboard) route group is protected). Keep marketing copy here and
// link to sign-in / sign-up; the design intent for this surface lives in
// specs/DESIGN.md (key screens & flows).
import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <h1>${project.name}</h1>
      <p>${project.description}</p>
      <nav>
        <Link href="/sign-in">Sign in</Link>
        <Link href="/sign-up">Get started</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    </main>
  );
}
