"use client";

import {
  OpenPanelComponent,
  type PostEventPayload,
  useOpenPanel,
} from "@openpanel/nextjs";

const isProd = process.env.NODE_ENV === "production";

const Provider = () => (
  <OpenPanelComponent
    clientId={process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID!}
    trackAttributes={true}
    trackScreenViews={isProd}
    trackOutgoingLinks={isProd}
  />
);

const track = (options: { event: string } & PostEventPayload["properties"]) => {
  const { track: openTrack } = useOpenPanel();

  if (!isProd) {
    // Use console.log for client-side dev logging
    // pino uses worker threads which aren't compatible with browser bundlers
    console.log("[Analytics]", options);

    return;
  }

  const { event, ...rest } = options;

  openTrack(event, rest);
};

export { Provider, track };
