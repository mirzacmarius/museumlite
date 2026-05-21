import "@v1/ui/globals.css";
import { Provider as AnalyticsProvider } from "@v1/analytics/client";
import { MotionProvider } from "@v1/ui/motion-provider";
import { cn } from "@v1/ui/utils";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ConvexClientProvider } from "./convex-client-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://museumlite.com"),
  title: "MuseumLite - Museum Collection Management Software",
  description:
    "Complete collection management for museums, galleries, and collectors. Track accessions, manage locations, handle loans, and publish your collection online. Start free.",
  keywords: [
    "museum software",
    "collection management",
    "museum database",
    "art collection software",
    "gallery management",
    "accession software",
    "artifact tracking",
    "museum cataloging",
  ],
  authors: [{ name: "MuseumLite" }],
  openGraph: {
    title: "MuseumLite - Museum Collection Management Software",
    description:
      "Complete collection management for museums, galleries, and collectors. Track accessions, manage locations, and publish your collection online.",
    url: "https://museumlite.com",
    siteName: "MuseumLite",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MuseumLite - Museum Collection Management Software",
    description:
      "Complete collection management for museums, galleries, and collectors.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          `${GeistSans.variable} ${GeistMono.variable}`,
          "antialiased dark min-h-screen bg-zinc-950 text-white selection:bg-neon-purple/30",
        )}
      >
        <MotionProvider>
          <ConvexClientProvider>
            <Header />
            {children}
            <Footer />
            <SpeedInsights />
            <Analytics />
          </ConvexClientProvider>
        </MotionProvider>

        <AnalyticsProvider />
      </body>
    </html>
  );
}
