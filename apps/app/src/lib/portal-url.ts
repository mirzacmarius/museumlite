export function getPublicPortalBaseUrl() {
  const productionPortalUrl = "https://www.museumlite.com";

  if (process.env.NEXT_PUBLIC_WEB_URL) {
    const configuredUrl = process.env.NEXT_PUBLIC_WEB_URL.replace(/\/+$/, "");
    return configuredUrl === "https://museumlite.com"
      ? productionPortalUrl
      : configuredUrl;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }

  return productionPortalUrl;
}
