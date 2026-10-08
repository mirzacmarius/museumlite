export type AuthRecoveryFlow =
  | "signIn"
  | "signUp"
  | "reset"
  | "code"
  | "otp"
  | "verify";

const failureMessageKeys = {
  signIn: "untranslatedComponents.auth.passwordSignInFailed",
  signUp: "untranslatedComponents.auth.accountCreationFailed",
  reset: "untranslatedComponents.auth.passwordResetCodeSendFailed",
  code: "untranslatedComponents.auth.codeVerificationFailed",
  otp: "untranslatedComponents.auth.uniqueCodeSendFailed",
  verify: "untranslatedComponents.auth.verificationCodeSendFailed",
} as const;

function recoveryPayload(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return null;
  }
  const { data } = error;
  if (typeof data !== "string") {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** Public auth failure code, when the provider returned one. */
export function readAuthRecoveryCode(error: unknown): string | null {
  const payload = recoveryPayload(error);
  if (!payload || typeof payload !== "object" || !("code" in payload)) {
    return null;
  }
  return typeof payload.code === "string" ? payload.code : null;
}

/**
 * Message key for a failed auth attempt. The key depends on the flow and
 * the public error code, never on whether an account exists.
 */
export function authFailureMessageKey(
  error: unknown,
  flow: AuthRecoveryFlow,
): string {
  if (readAuthRecoveryCode(error) === "TooManyCodeRequests") {
    return "untranslatedComponents.auth.tooManyAttempts";
  }
  return failureMessageKeys[flow];
}

/** Password-step help. The same key is used for every email in that mode. */
export function passwordStepMessageKey(mode: "signIn" | "signUp"): string {
  return mode === "signUp"
    ? "untranslatedComponents.auth.createPasswordForAccount"
    : "untranslatedComponents.auth.enterPasswordForEmail";
}
