"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@v1/backend/convex/_generated/api";
import { useConvex } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthEmailForm } from "@/auth/email";
import { AuthPasswordForm } from "@/auth/password";
import type {
  AuthErrorInfo,
  AuthMode,
  AuthStep,
  UniqueCodeFlow,
} from "@/auth/types";
import { AuthUniqueCodeForm } from "@/auth/unique-code";
import { useCurrentLocale, useI18n } from "@/locales/client";

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

interface AuthFormRootProps {
  currentAuthMode: AuthMode;
  mode: AuthMode;
  step: AuthStep;
  email: string;
  setEmail: (email: string) => void;
  setMode: (mode: AuthMode) => void;
  setStep: (step: AuthStep) => void;
  setErrorInfo: (error: AuthErrorInfo | undefined) => void;
  setCodeFlow: (flow: UniqueCodeFlow) => void;
  codeFlow: UniqueCodeFlow;
  onSignedIn: () => void;
}

function getPasswordStepHelpText({
  email,
  mode,
  passwordAccountExists,
  translate,
}: {
  email: string;
  mode: AuthMode;
  passwordAccountExists: boolean | null;
  translate: Translate;
}) {
  if (mode === "signUp") {
    if (passwordAccountExists === false) {
      return translate(
        "untranslatedComponents.auth.passwordAccountMissingSetup",
        { email },
      );
    }

    return translate("untranslatedComponents.auth.createPasswordForAccount", {
      email,
    });
  }

  if (passwordAccountExists) {
    return translate("untranslatedComponents.auth.existingAccountPassword", {
      email,
    });
  }

  return translate("untranslatedComponents.auth.enterPasswordForEmail", {
    email,
  });
}

function AuthPasswordStepNotice({
  email,
  mode,
  passwordAccountExists,
  translate,
}: {
  email: string;
  mode: AuthMode;
  passwordAccountExists: boolean | null;
  translate: Translate;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      {getPasswordStepHelpText({
        email,
        mode,
        passwordAccountExists,
        translate,
      })}
    </div>
  );
}

export function AuthFormRoot({
  currentAuthMode,
  mode,
  step,
  email,
  setEmail,
  setMode,
  setStep,
  setErrorInfo,
  setCodeFlow,
  codeFlow,
  onSignedIn,
}: AuthFormRootProps) {
  const translate = useI18n();
  const locale = useCurrentLocale();
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const [passwordAccountExists, setPasswordAccountExists] = useState<
    boolean | null
  >(null);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }
    return "";
  };

  const handleEmailVerification = async (nextEmail: string) => {
    const normalizedEmail = nextEmail.trim().toLowerCase();
    setEmail(normalizedEmail);
    setErrorInfo(undefined);

    try {
      const result = await convex.query(
        api.authLookup.hasPasswordAccountForEmail,
        {
          email: normalizedEmail,
        },
      );

      setPasswordAccountExists(result.hasPasswordAccount);
      setMode(result.hasPasswordAccount ? "signIn" : "signUp");
      setStep("password");
    } catch {
      setPasswordAccountExists(null);
      setErrorInfo({
        message: translate(
          "untranslatedComponents.auth.emailVerificationFailed",
        ),
      });
      toast.error(translate("untranslatedComponents.auth.accountStatusFailed"));
    }
  };

  const handleEmailClear = () => {
    setMode(currentAuthMode);
    setErrorInfo(undefined);
    setEmail("");
    setPasswordAccountExists(null);
    setStep("email");
  };

  const requestOtpCode = async () => {
    try {
      const result = await signIn("resend-otp", {
        email,
        redirectTo: `/${locale}`,
      });
      if (result.signingIn) {
        onSignedIn();
      }
      return true;
    } catch {
      toast.error(
        translate("untranslatedComponents.auth.uniqueCodeSendFailed"),
      );
      return false;
    }
  };

  const requestPasswordVerificationCode = async () => {
    try {
      const result = await signIn("password-with-reset", {
        email,
        flow: "email-verification",
        redirectTo: `/${locale}`,
      });
      if (result.signingIn) {
        onSignedIn();
      }
      return true;
    } catch {
      toast.error(
        translate("untranslatedComponents.auth.verificationCodeSendFailed"),
      );
      return false;
    }
  };

  const requestResetCode = async () => {
    if (passwordAccountExists === false) {
      setCodeFlow("otp");
      setStep("password");
      setMode("signUp");
      setErrorInfo({
        message: translate(
          "untranslatedComponents.auth.passwordLoginRequiredForReset",
        ),
      });
      toast.error(
        translate("untranslatedComponents.auth.passwordLoginRequired"),
      );
      return false;
    }

    try {
      const result = await signIn("password-with-reset", {
        email,
        flow: "reset",
        redirectTo: `/${locale}`,
      });
      if (result.signingIn) {
        onSignedIn();
      }
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes("InvalidAccountId")) {
        setCodeFlow("otp");
        setStep("password");
        setMode("signUp");
        setPasswordAccountExists(false);
        setErrorInfo({
          message: translate(
            "untranslatedComponents.auth.passwordLoginRequiredForReset",
          ),
        });
        toast.error(
          translate("untranslatedComponents.auth.passwordLoginRequired"),
        );
        return false;
      }
      toast.error(
        translate("untranslatedComponents.auth.passwordResetCodeSendFailed"),
      );
      return false;
    }
  };

  const requestCode = async (flow: UniqueCodeFlow) => {
    if (flow === "reset") {
      await requestResetCode();
      return;
    }

    if (flow === "passwordVerify") {
      await requestPasswordVerificationCode();
      return;
    }

    await requestOtpCode();
  };

  const openResetFlow = async () => {
    const ok = await requestResetCode();
    if (!ok) {
      return;
    }
    setCodeFlow("reset");
    setStep("uniqueCode");
  };

  const openOtpFlow = async () => {
    const ok = await requestOtpCode();
    if (!ok) {
      return;
    }
    setCodeFlow("otp");
    setStep("uniqueCode");
  };

  const openPasswordVerificationFlow = () => {
    setCodeFlow("passwordVerify");
    setStep("uniqueCode");
  };

  if (step === "email") {
    return (
      <AuthEmailForm
        key={email}
        defaultEmail={email}
        onSubmit={handleEmailVerification}
      />
    );
  }

  if (step === "password") {
    return (
      <div className="space-y-4">
        <AuthPasswordStepNotice
          email={email}
          mode={mode}
          passwordAccountExists={passwordAccountExists}
          translate={translate}
        />
        <AuthPasswordForm
          canSignInWithPassword={passwordAccountExists !== false}
          email={email}
          mode={mode}
          onEmailClear={handleEmailClear}
          onForgotPassword={openResetFlow}
          onModeChange={setMode}
          onPasswordVerificationRequired={openPasswordVerificationFlow}
          onSignedIn={onSignedIn}
          onUniqueCodeRequest={openOtpFlow}
        />
      </div>
    );
  }

  if (step === "uniqueCode") {
    return (
      <AuthUniqueCodeForm
        email={email}
        flow={codeFlow}
        onEmailClear={handleEmailClear}
        onRequestCode={requestCode}
        onSignedIn={onSignedIn}
      />
    );
  }

  return null;
}
