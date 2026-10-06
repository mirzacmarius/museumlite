function getAppOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured || null;
}

export function getAppLoginUrl(locale = "en"): string {
  const appOrigin = getAppOrigin();
  const path = `/${locale}/login`;
  if (!appOrigin) return path;
  return new URL(path, appOrigin).href;
}

export function getAppRegisterUrl(locale = "en"): string {
  const appOrigin = getAppOrigin();
  const path = `/${locale}/register`;
  if (!appOrigin) return path;
  return new URL(path, appOrigin).href;
}
