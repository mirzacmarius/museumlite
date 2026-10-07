import { describe, expect, test } from "vitest";
import {
  authFailureMessageKey,
  passwordStepMessageKey,
} from "./recovery-messages";

const disclosureKeys = [
  "untranslatedComponents.auth.existingAccountPassword",
  "untranslatedComponents.auth.passwordAccountMissingSetup",
  "untranslatedComponents.auth.passwordLoginRequiredFirst",
  "untranslatedComponents.auth.passwordLoginRequired",
  "untranslatedComponents.auth.passwordLoginRequiredForReset",
  "untranslatedComponents.auth.accountStatusFailed",
  "untranslatedComponents.auth.emailVerificationFailed",
];

describe("neutral auth recovery messages", () => {
  test("password help depends on the chosen mode, not on account existence", () => {
    expect(passwordStepMessageKey("signIn")).toBe(
      "untranslatedComponents.auth.enterPasswordForEmail",
    );
    expect(passwordStepMessageKey("signUp")).toBe(
      "untranslatedComponents.auth.createPasswordForAccount",
    );
  });

  test("a wrong password and an unknown account share the sign-in message", () => {
    const wrongPassword = authFailureMessageKey(
      { data: { code: "InvalidCredentials" } },
      "signIn",
    );
    const unknownAccount = authFailureMessageKey(
      new Error("InvalidAccountId"),
      "signIn",
    );
    expect(wrongPassword).toBe(
      "untranslatedComponents.auth.passwordSignInFailed",
    );
    expect(unknownAccount).toBe(wrongPassword);
  });

  test("code-request limits use one message for every flow", () => {
    const error = { data: '{"code":"TooManyCodeRequests"}' };
    expect(
      (["signIn", "signUp", "reset", "code", "otp", "verify"] as const).map(
        (flow) => authFailureMessageKey(error, flow),
      ),
    ).toEqual([
      "untranslatedComponents.auth.tooManyAttempts",
      "untranslatedComponents.auth.tooManyAttempts",
      "untranslatedComponents.auth.tooManyAttempts",
      "untranslatedComponents.auth.tooManyAttempts",
      "untranslatedComponents.auth.tooManyAttempts",
      "untranslatedComponents.auth.tooManyAttempts",
    ]);
  });

  test("public failure keys do not name account existence", () => {
    const keys = [
      passwordStepMessageKey("signIn"),
      passwordStepMessageKey("signUp"),
      authFailureMessageKey({ data: { code: "InvalidCredentials" } }, "signIn"),
      authFailureMessageKey({ data: { code: "InvalidCode" } }, "code"),
      authFailureMessageKey({ data: { code: "SignUpUnavailable" } }, "signUp"),
      authFailureMessageKey(new Error("InvalidAccountId"), "reset"),
    ];
    expect(keys.filter((key) => disclosureKeys.includes(key))).toEqual([]);
  });
});
