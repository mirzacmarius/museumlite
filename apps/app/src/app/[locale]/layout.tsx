import "../globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { MotionProvider } from "@v1/ui/motion-provider";
import { Toaster } from "@v1/ui/sonner";
import { TooltipProvider } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import { setStaticParamsLocale } from "next-international/server";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { I18nProviderClient } from "@/locales/client";
import { getI18n, getStaticParams } from "@/locales/server";
import { AppUiLocaleProvider } from "@/locales/ui-provider";
import { ConvexClientProvider } from "../convex-client-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export function generateStaticParams() {
  return getStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // The locale is a root param, so metadata resolves at build time instead of
  // reading the locale header on every request.
  setStaticParamsLocale((await params).locale);
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
              {/* The auth provider reads the session cookie, so it streams in
                  behind the static document shell. */}
              <Suspense>
                <AuthServerProvider>
                  <ConvexClientProvider>
                    <I18nProviderClient locale={locale}>
                      <AppUiLocaleProvider>
                        {children}
                        <Toaster />
                      </AppUiLocaleProvider>
                    </I18nProviderClient>
                  </ConvexClientProvider>
                </AuthServerProvider>
              </Suspense>
            </MotionProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

async function AuthServerProvider({ children }: { children: React.ReactNode }) {
  // Convex Auth stamps its server state with Date.now(), which Cache
  // Components only allows at request time.
  await connection();
  return (
    <ConvexAuthNextjsServerProvider>{children}</ConvexAuthNextjsServerProvider>
  );
}
