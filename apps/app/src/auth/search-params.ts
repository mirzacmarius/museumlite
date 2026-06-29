interface BuildAuthPathArgs {
  email?: string;
  returnTo?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getFirstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export function getSafeReturnTo(
  value: string | string[] | undefined,
): string | undefined {
  const returnTo = getFirstSearchParam(value);
  return returnTo?.startsWith("/") ? returnTo : undefined;
}

export function getInitialAuthEmail(
  value: string | string[] | undefined,
): string | undefined {
  const email = getFirstSearchParam(value)?.trim().toLowerCase();
  if (!email || !emailRegex.test(email)) return undefined;
  return email;
}

export function buildAuthPath(
  pathname: "/login" | "/register",
  { email, returnTo }: BuildAuthPathArgs,
): string {
  const params = new URLSearchParams();

  if (returnTo) params.set("returnTo", returnTo);
  if (email) params.set("email", email);

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
