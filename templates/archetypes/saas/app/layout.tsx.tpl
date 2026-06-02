// Root layout for ${project.name} (Next.js App Router).
//
// Wraps the whole app in <ClerkProvider> so auth state is available everywhere
// (auth provider: ${auth.provider}). The global stylesheet is the materialized
// design-system theme — when the design system is installed, /ack-init renders
// design-system/theme/globals.css from your brand token; copy or import it as
// app/globals.css. See specs/DESIGN.md for the design intent.
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "${project.name}",
  description: "${project.description}",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
