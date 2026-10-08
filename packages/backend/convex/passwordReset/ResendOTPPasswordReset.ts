import { Email } from "@convex-dev/auth/providers/Email";
import {
  buildAuthCodeEmail,
  getEmailLocaleFromAuthUrl,
  getEmailTranslations,
} from "../email/translations";
import { env } from "../env";
import { generateVerificationCode } from "../utils/verificationCode";

export const ResendOTPPasswordReset = Email({
  id: "resend-otp-password-reset",
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
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
      subject: messages.passwordSubject,
      body: messages.passwordBody,
      token,
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
      throw new Error(
        `Failed to send password reset email: ${response.status} ${body}`,
      );
    }
  },
});
