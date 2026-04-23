export function getPublicPortalBaseUrl() {
  if (process.env.NEXT_PUBLIC_WEB_URL) {
    return process.env.NEXT_PUBLIC_WEB_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }

  return "https://museumlite.com";
}
