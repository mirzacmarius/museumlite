import { Email } from "@convex-dev/auth/providers/Email";
import {
  buildAuthCodeEmail,
  getEmailLocaleFromAuthUrl,
  getEmailTranslations,
} from "../email/translations";
import { env } from "../env";
import { generateVerificationCode } from "../utils/verificationCode";

export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  maxAge: 60 * 20,
  async generateVerificationToken() {
    return generateVerificationCode();
  },
  sendVerificationRequest: async ({
    identifier: email,
    provider,
    token,
    url,
  }) => {
    const locale = getEmailLocaleFromAuthUrl(url);
    const messages = getEmailTranslations(locale).auth;
    const emailCopy = buildAuthCodeEmail({
      locale,
      subject: messages.verificationSubject,
      body: messages.verificationBody,
      token,
      additionalMessage: messages.expires,
    });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from,
        to: [email],
        subject: emailCopy.subject,
        html: emailCopy.html,
        text: emailCopy.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to send OTP email: ${response.status} ${body}`);
    }
  },
});
