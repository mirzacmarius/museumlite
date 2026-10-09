import { getRouteLocale } from "./locale-routes";

/** Detail-page query parameter holding the list URL the record was opened from. */
export const RETURN_PATH_PARAM = "from";

const MAX_RETURN_PATH_LENGTH = 2000;
const PARSE_BASE = "https://museumlite.invalid";

interface SearchParamsReader {
  toString(): string;
}

function hasControlCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * An app-relative path (and query) that is safe to navigate to, or null.
 * Absolute, protocol-relative, backslash and control-character forms are
 * rejected so a shared link cannot redirect away from the app.
 */
function toSafeReturnPath(value: string | null): string | null {
  if (!value || value.length > MAX_RETURN_PATH_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || hasControlCharacter(value)) return null;
  const url = new URL(value, PARSE_BASE);
  if (url.origin !== PARSE_BASE) return null;
  return `${url.pathname}${url.search}`;
}

/** The current list URL to remember, without the rewritten locale segment. */
export function listReturnPath(
  pathname: string,
  searchParams: SearchParamsReader,
): string {
  const locale = getRouteLocale(pathname);
  const path = locale ? pathname.slice(locale.length + 1) || "/" : pathname;
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

/** A detail link that remembers the list it was opened from. */
export function withReturnPath(href: string, returnPath: string | null) {
  if (!returnPath) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${RETURN_PATH_PARAM}=${encodeURIComponent(returnPath)}`;
}

/**
 * Where a detail page's back link goes: the originating list when the link
 * carried a safe one, otherwise the list's default view.
 */
export function backToResultsHref(
  returnParam: string | null,
  listHref: string,
): { href: string; fromResults: boolean } {
  const returnPath = toSafeReturnPath(returnParam);
  return returnPath
    ? { href: returnPath, fromResults: true }
    : { href: listHref, fromResults: false };
}
