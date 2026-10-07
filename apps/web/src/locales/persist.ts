import { createWebLocaleCookieOptions } from "./messages";

export async function persistWebLocale(value: string | undefined) {
  if (typeof window === "undefined") return;

  const options = createWebLocaleCookieOptions(value);
  const expires = new Date(Date.now() + options.maxAge * 1000);
  const cookieStore = window.cookieStore;

  if (cookieStore) {
    await cookieStore.set({
      name: options.name,
      value: options.value,
      expires: expires.getTime(),
      path: options.path,
      sameSite: options.sameSite,
    });
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const cookie = [
    `${encodeURIComponent(options.name)}=${encodeURIComponent(options.value)}`,
    `Max-Age=${options.maxAge}`,
    `Expires=${expires.toUTCString()}`,
    `Path=${options.path}`,
    "SameSite=Lax",
  ].join("; ");

  // biome-ignore lint/suspicious/noDocumentCookie: document.cookie is the compatibility fallback when CookieStore is unavailable.
  document.cookie = `${cookie}${secure}`;
}
