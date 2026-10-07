import type { EmailProviderSendVerificationRequestParams } from "@auth/core/providers/email";
import {
  escapeEmailHtml,
  getEmailLocaleFromAuthUrl,
  getEmailTranslations,
} from "./translations";

export async function sendLocalizedMagicLinkEmail({
  identifier,
  url,
  provider,
}: EmailProviderSendVerificationRequestParams): Promise<void> {
  const locale = getEmailLocaleFromAuthUrl(url);
  const messages = getEmailTranslations(locale).auth;
  const safeUrl = escapeEmailHtml(url);
  const safeEmail = escapeEmailHtml(identifier);
  const safeCta = escapeEmailHtml(messages.magicLinkCta);
  const body = escapeEmailHtml(messages.magicLinkBody);
  const ignore = escapeEmailHtml(messages.magicLinkIgnore);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: provider.from,
      to: identifier,
      subject: messages.magicLinkSubject,
      html: `<html lang="${locale}"><body><p>${body}</p><p><a href="${safeUrl}">${safeCta}</a></p><p>${safeEmail}</p><p>${ignore}</p><p>${escapeEmailHtml(getEmailTranslations(locale).footerBrand)}</p></body></html>`,
      text: `${messages.magicLinkBody}\n${url}\n\n${messages.magicLinkIgnore}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend error: ${JSON.stringify(await response.json())}`);
  }
}
