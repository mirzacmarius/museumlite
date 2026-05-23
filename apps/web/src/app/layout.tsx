import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
