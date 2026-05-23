export function getAppLoginUrl(): string {
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!appOrigin) return "/login";
  return new URL("/login", appOrigin).href;
}
