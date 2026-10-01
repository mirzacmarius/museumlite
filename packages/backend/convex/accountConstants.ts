export const PASSWORD_PROVIDERS: readonly string[] = [
  "password",
  "password-with-reset",
  "password-code",
  "password-link",
];

export const EMAIL_ACCOUNT_PROVIDERS: readonly string[] = [
  ...PASSWORD_PROVIDERS,
  "magic-link",
  "resend-otp",
  "resend-otp-password-reset",
];
