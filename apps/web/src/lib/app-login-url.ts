function getAppOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return configured || null;
}

export function getAppLoginUrl(): string {
  const appOrigin = getAppOrigin();
  if (!appOrigin) return "/login";
  return new URL("/login", appOrigin).href;
}

export function getAppRegisterUrl(): string {
  const appOrigin = getAppOrigin();
  if (!appOrigin) return "/register";
  return new URL("/register", appOrigin).href;
}
