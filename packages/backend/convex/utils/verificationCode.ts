import { generateRandomString } from "@oslojs/crypto/random";

export function generateVerificationCode(): string {
  return generateRandomString(
    {
      read: (bytes) => {
        crypto.getRandomValues(bytes);
      },
    },
    "0123456789",
    8,
  );
}
