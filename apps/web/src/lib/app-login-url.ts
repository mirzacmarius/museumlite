function getAppOrigin(): string | null {
  return process.env.NEXT_PUBLIC_APP_URL ?? null;
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
