import { cookies } from "next/headers";
import {
  formatWebMessage,
  resolveWebLocale,
  WEB_LOCALE_COOKIE,
  type WebLocale,
  type WebMessageKey,
  webMessages,
} from "./messages";

export { WEB_LOCALE_COOKIE } from "./messages";

export async function getWebLocale(): Promise<WebLocale> {
  const value = (await cookies()).get(WEB_LOCALE_COOKIE)?.value;
  return resolveWebLocale(value);
}

export async function getWebI18n() {
  const locale = await getWebLocale();
  return {
    locale,
    t: (key: WebMessageKey, values?: Record<string, string | number>): string =>
      formatWebMessage(webMessages[locale][key], values),
  };
}
