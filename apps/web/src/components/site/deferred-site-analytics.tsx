"use client";

import dynamic from "next/dynamic";

const AnalyticsProvider = dynamic(
  () =>
    import("@v1/analytics/client").then((mod) => ({
      default: mod.Provider,
    })),
  { ssr: false },
);

const VercelAnalytics = dynamic(
  () => import("@vercel/analytics/next").then((mod) => mod.Analytics),
  { ssr: false },
);

const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { ssr: false },
);

export function DeferredSiteAnalytics() {
  const hasOpenPanel = Boolean(
    process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID?.trim(),
  );

  return (
    <>
      <VercelAnalytics />
      <SpeedInsights />
      {hasOpenPanel ? <AnalyticsProvider /> : null}
    </>
  );
}
