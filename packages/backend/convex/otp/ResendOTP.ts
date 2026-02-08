import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";
import { env } from "../env";

export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: env.RESEND_API_KEY,
  from: env.RESEND_SENDER_EMAIL_AUTH,
  maxAge: 60 * 20,
  async generateVerificationToken() {
    return generateRandomString(8, alphabet("0-9"));
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
        subject: "Your Museumlite verification code",
        html: `<p>Your verification code is <strong>${token}</strong>.</p>`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to send OTP email: ${response.status} ${body}`);
    }
  },
});
