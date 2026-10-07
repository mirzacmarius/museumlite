"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { AuthEmailForm } from "@/auth/email";
import { AuthPasswordForm } from "@/auth/password";
import {
  authFailureMessageKey,
  passwordStepMessageKey,
} from "@/auth/recovery-messages";
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

function AuthPasswordStepNotice({
  email,
  mode,
  translate,
}: {
  email: string;
  mode: AuthMode;
  translate: Translate;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      {translate(passwordStepMessageKey(mode), { email })}
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

  const handleEmailVerification = async (nextEmail: string) => {
    setEmail(nextEmail.trim().toLowerCase());
    setErrorInfo(undefined);
    setStep("password");
  };

  const handleEmailClear = () => {
    setMode(currentAuthMode);
    setErrorInfo(undefined);
    setEmail("");
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
    } catch (error) {
      toast.error(translate(authFailureMessageKey(error, "otp")));
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
    } catch (error) {
      toast.error(translate(authFailureMessageKey(error, "verify")));
      return false;
    }
  };

  const requestResetCode = async () => {
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
      toast.error(translate(authFailureMessageKey(error, "reset")));
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
          translate={translate}
        />
        <AuthPasswordForm
          email={email}
          mode={mode}
          onEmailClear={handleEmailClear}
          onForgotPassword={openResetFlow}
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
