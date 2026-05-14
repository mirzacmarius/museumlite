import * as React from "react";

export function usePlatform() {
  const [isMac, setIsMac] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const detectPlatform = () => {
      if (
        typeof navigator !== "undefined" &&
        "userAgentData" in navigator &&
        navigator.userAgentData
      ) {
        const userAgentData = navigator.userAgentData as {
          platform?: string;
        };
        return userAgentData.platform === "macOS";
      }

      if (typeof navigator !== "undefined" && navigator.platform) {
        return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      }

      return false;
    };

    setIsMac(detectPlatform());
  }, []);

  return { isMac: !!isMac };
}
