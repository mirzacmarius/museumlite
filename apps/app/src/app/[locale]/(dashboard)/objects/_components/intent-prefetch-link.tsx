"use client";

import Link from "next/link";
import { type ComponentProps, useState } from "react";

/**
 * A link that prefetches the destination's own content once the user shows
 * intent (hover, focus or touch). Until then it prefetches only the shared
 * App Shell, so a long list doesn't ask the server for every visible row.
 */
export function IntentPrefetchLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? true : "auto"}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
