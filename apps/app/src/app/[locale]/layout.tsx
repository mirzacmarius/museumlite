import "../globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { MotionProvider } from "@v1/ui/motion-provider";
import { Toaster } from "@v1/ui/sonner";
import { TooltipProvider } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { I18nProviderClient } from "@/locales/client";
import { getI18n } from "@/locales/server";
import { AppUiLocaleProvider } from "@/locales/ui-provider";
import { ConvexClientProvider } from "../convex-client-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getI18n();

  return {
    title: "Museumlite",
    description: translate("untranslatedComponents.metadata.description"),
    keywords: translate("untranslatedComponents.metadata.keywords").split(", "),
  };
}

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
                    <AppUiLocaleProvider>
                      {children}
                      <Toaster />
                    </AppUiLocaleProvider>
                  </I18nProviderClient>
                </ConvexClientProvider>
              </MotionProvider>
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
