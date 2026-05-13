import "../globals.css";
import { I18nProviderClient } from "@/locales/client";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { MotionProvider } from "@v1/ui/motion-provider";
import { Toaster } from "@v1/ui/sonner";
import { TooltipProvider } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import { ConvexClientProvider } from "../convex-client-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Museumlite",
  description:
    "Museumlite is a platform for managing museum collections and objects.",
  keywords: [
    "Museumlite",
    "Museum",
    "Collections",
    "Objects",
    "Management",
    "Art",
    "Antiques",
    "Memorabilia",
    "Exhibitions",
    "Inventory",
    "Sales",
    "Loans",
    "Cataloging",
    "Digital Collections",
    "Museum Management",
    "Art Management",
    "Antique Management",
    "Memorabilia Management",
    "Exhibition Management",
    "Inventory Management",
    "Sales Management",
    "Loan Management",
    "Cataloging Management",
    "Digital Collections Management",
    "Museum Management Software",
    "Art Management Software",
    "Antique Management Software",
    "Memorabilia Management Software",
    "Exhibition Management Software",
    "Inventory Management Software",
    "Sales Management Software",
    "Loan Management Software",
    "Cataloging Management Software",
    "Digital Collections Management Software",
    "Museum Management System",
    "Art Management System",
    "Antique Management System",
    "Memorabilia Management System",
    "Exhibition Management System",
    "Inventory Management System",
    "Sales Management System",
    "Loan Management System",
    "Cataloging Management System",
    "Digital Collections Management System",
    "Museum Management Platform",
    "Art Management Platform",
    "Antique Management Platform",
    "Memorabilia Management Platform",
    "Exhibition Management Platform",
    "Inventory Management Platform",
    "Sales Management Platform",
    "Loan Management Platform",
    "Cataloging Management Platform",
    "Digital Collections Management Platform",
    "Museum Management Application",
    "Art Management Application",
    "Antique Management Application",
    "Memorabilia Management Application",
    "Exhibition Management Application",
    "Inventory Management Application",
    "Sales Management Application",
    "Loan Management Application",
    "Cataloging Management Application",
    "Digital Collections Management Application",
    "Museum Management Tool",
    "Art Management Tool",
    "Antique Management Tool",
    "Memorabilia Management Tool",
    "Exhibition Management Tool",
    "Inventory Management Tool",
    "Sales Management Tool",
    "Loan Management Tool",
    "Cataloging Management Tool",
    "Digital Collections Management Tool",
    "Museum Management Software",
    "Art Management Software",
    "Antique Management Software",
    "Memorabilia Management Software",
    "Exhibition Management Software",
    "Inventory Management Software",
    "Sales Management Software",
    "Loan Management Software",
    "Cataloging Management Software",
    "Digital Collections Management Software",
    "Museum Management System",
    "Art Management System",
    "Antique Management System",
    "Memorabilia Management System",
    "Exhibition Management System",
    "Inventory Management System",
    "Sales Management System",
    "Loan Management System",
    "Cataloging Management System",
    "Digital Collections Management System",
    "Museum Management Platform",
    "Art Management Platform",
    "Antique Management Platform",
    "Memorabilia Management Platform",
    "Exhibition Management Platform",
    "Inventory Management Platform",
    "Sales Management Platform",
    "Loan Management Platform",
    "Cataloging Management Platform",
    "Digital Collections Management Platform",
    "Museum Management Application",
    "Art Management Application",
    "Antique Management Application",
    "Memorabilia Management Application",
    "Exhibition Management Application",
    "Inventory Management Application",
    "Sales Management Application",
    "Loan Management Application",
    "Cataloging Management Application",
    "Digital Collections Management Application",
    "Museum Management Tool",
    "Art Management Tool",
    "Antique Management Tool",
    "Memorabilia Management Tool",
    "Exhibition Management Tool",
    "Inventory Management Tool",
    "Sales Management Tool",
    "Loan Management Tool",
    "Cataloging Management Tool",
    "Digital Collections Management Tool",
    "Museum Management Software",
    "Art Management Software",
    "Antique Management Software",
    "Memorabilia Management Software",
    "Exhibition Management Software",
    "Inventory Management Software",
    "Sales Management Software",
    "Loan Management Software",
    "Cataloging Management Software",
    "Digital Collections Management Software",
    "Museum Management System",
    "Art Management System",
    "Antique Management System",
    "Memorabilia Management System",
    "Exhibition Management System",
    "Inventory Management System",
    "Sales Management System",
    "Loan Management System",
    "Cataloging Management System",
    "Digital Collections Management System",
    "Museum Management Platform",
    "Art Management Platform",
    "Antique Management Platform",
    "Memorabilia Management Platform",
    "Exhibition Management Platform",
    "Inventory Management Platform",
    "Sales Management Platform",
    "Loan Management Platform",
    "Cataloging Management Platform",
    "Digital Collections Management Platform",
    "Museum Management Application",
    "Art Management Application",
    "Antique Management Application",
    "Memorabilia Management Application",
    "Exhibition Management Application",
    "Inventory Management Application",
    "Sales Management Application",
    "Loan Management Application",
    "Cataloging Management Application",
    "Digital Collections Management Application",
    "Museum Management Tool",
    "Art Management Tool",
    "Antique Management Tool",
    "Memorabilia Management Tool",
    "Exhibition Management Tool",
    "Inventory Management Tool",
    "Sales Management Tool",
    "Loan Management Tool",
    "Cataloging Management Tool",
    "Digital Collections Management Tool",
    "Museum Management Software",
    "Art Management Software",
    "Antique Management Software",
    "Memorabilia Management Software",
    "Exhibition Management Software",
    "Inventory Management Software",
    "Sales Management Software",
    "Loan Management Software",
    "Cataloging Management Software",
    "Digital Collections Management Software",
    "Museum Management System",
    "Art Management System",
    "Antique Management System",
    "Memorabilia Management System",
    "Exhibition Management System",
    "Inventory Management System",
    "Sales Management System",
    "Loan Management System",
    "Cataloging Management System",
    "Digital Collections Management System",
    "Museum Management Platform",
    "Art Management Platform",
    "Antique Management Platform",
    "Memorabilia Management Platform",
    "Exhibition Management Platform",
    "Inventory Management Platform",
    "Sales Management Platform",
    "Loan Management Platform",
    "Cataloging Management Platform",
    "Digital Collections Management Platform",
    "Museum Management Application",
    "Art Management Application",
    "Antique Management Application",
    "Memorabilia Management Application",
    "Exhibition Management Application",
    "Inventory Management Application",
    "Sales Management Application",
  ],
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)" },
    { media: "(prefers-color-scheme: dark)" },
  ],
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang={locale} suppressHydrationWarning>
        <body
          className={cn(inter.className, GeistMono.variable, "antialiased")}
          suppressHydrationWarning
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider delayDuration={0}>
              <MotionProvider>
                <ConvexClientProvider>
                  <I18nProviderClient locale={locale}>
                    {children}
                  </I18nProviderClient>
                </ConvexClientProvider>
              </MotionProvider>
            </TooltipProvider>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
