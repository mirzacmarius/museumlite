import * as React from "react";

export function usePlatform() {
  const [isMac, setIsMac] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const detectPlatform = () => {
      // Check userAgentData first (modern API)
      if (
        typeof navigator !== "undefined" &&
        "userAgentData" in navigator &&
        navigator.userAgentData
      ) {
        const userAgentData = navigator.userAgentData as {
          platform?: string;
        };
        setIsMac(userAgentData.platform === "macOS");
        return;
      }

      // Fallback to navigator.platform
      if (typeof navigator !== "undefined" && navigator.platform) {
        setIsMac(
          navigator.platform.toUpperCase().indexOf("MAC") >= 0,
        );
        return;
      }

      // Default to false if we can't detect
      setIsMac(false);
    };

    detectPlatform();
  }, []);

  return { isMac: !!isMac };
}
