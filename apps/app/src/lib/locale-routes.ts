export const supportedLocales = ["en", "fr", "es", "no", "ro"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export function getRouteLocale(pathname: string): SupportedLocale | undefined {
  const segment = pathname.split("/")[1];
  return supportedLocales.find((locale) => locale === segment);
}

function getUnlocalizedPath(pathname: string): string {
  const locale = getRouteLocale(pathname);
  if (!locale) return pathname;
  return pathname.slice(locale.length + 1) || "/";
}

export function isSignInRoute(pathname: string): boolean {
  const path = getUnlocalizedPath(pathname).replace(/\/$/, "") || "/";
  return path === "/login" || path === "/register";
}

export function isInviteRoute(pathname: string): boolean {
  const path = getUnlocalizedPath(pathname);
  return path.startsWith("/invite/");
}

export function getSignInRedirectPath(pathname: string): string {
  const locale = getRouteLocale(pathname);
  return locale ? `/${locale}/` : "/";
}

export function getLoginRedirectPath(pathname: string): string {
  const locale = getRouteLocale(pathname);
  return locale ? `/${locale}/login` : "/login";
}
