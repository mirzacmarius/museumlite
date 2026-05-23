import "@v1/ui/globals.css";
import { Provider as AnalyticsProvider } from "@v1/analytics/client";
import { MotionProvider } from "@v1/ui/motion-provider";
import { cn } from "@v1/ui/utils";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { ConvexClientProvider } from "./convex-client-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://museumlite.com"),
  title: {
    default: "MuseumLite — Museum Management, Reimagined",
    template: "%s | MuseumLite",
  },
  description:
    "MuseumLite is the operating system for modern museums — collections, exhibitions, conservation, and library in one elegant platform.",
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
    title: "MuseumLite — Museum Management, Reimagined",
    description:
      "The operating system for modern museums — collections, exhibitions, conservation, and library in one platform.",
    url: "https://museumlite.com",
    siteName: "MuseumLite",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MuseumLite — Museum Management, Reimagined",
    description:
      "The operating system for modern museums — collections, exhibitions, conservation, and library.",
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
          "min-h-screen antialiased",
        )}
      >
        <MotionProvider>
          <ConvexClientProvider>
            {children}
            <SpeedInsights />
            <Analytics />
          </ConvexClientProvider>
        </MotionProvider>

        <AnalyticsProvider />
      </body>
    </html>
  );
}
