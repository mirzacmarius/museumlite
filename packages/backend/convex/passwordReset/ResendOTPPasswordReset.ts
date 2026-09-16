import { Email } from "@convex-dev/auth/providers/Email";
import { env } from "../env";
import { generateVerificationCode } from "../utils/verificationCode";

export const ResendOTPPasswordReset = Email({
  id: "resend-otp-password-reset",
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  async generateVerificationToken() {
    return generateVerificationCode();
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from,
        to: [email],
        subject: "Reset your Museumlite password",
        html: `<p>Your password reset code is <strong>${token}</strong>.</p>`,
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
