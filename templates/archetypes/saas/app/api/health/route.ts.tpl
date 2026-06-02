// Health route for ${project.name}: GET /api/health -> { status: "ok" }.
//
// Public (the Clerk middleware matcher runs on it but the route itself does not
// call auth.protect()). Use it for uptime checks and ${hosting.target} health
// probes. Keep it cheap and dependency-free.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
