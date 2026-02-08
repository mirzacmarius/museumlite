"use client";

import { AuthEmailForm } from "@/auth/email";
import { AuthPasswordForm } from "@/auth/password";
import type {
  AuthErrorInfo,
  AuthMode,
  AuthStep,
  UniqueCodeFlow,
} from "@/auth/types";
import { AuthUniqueCodeForm } from "@/auth/unique-code";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@v1/backend/convex/_generated/api";
import { useConvex } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

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
    } catch {
      setPasswordAccountExists(null);
    }

    setStep("password");
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
      const result = await signIn("resend-otp", { email });
      if (result.signingIn) {
        onSignedIn();
      }
      return true;
    } catch {
      toast.error("Could not send a unique code.");
      return false;
    }
  };

  const requestResetCode = async () => {
    if (passwordAccountExists === false) {
      setCodeFlow("otp");
      setStep("password");
      setMode("signUp");
      setErrorInfo({
        message:
          "No password login exists for this email yet. Create one first, then you can reset it.",
      });
      toast.error("No password login exists for this email yet.");
      return false;
    }

    try {
      const result = await signIn("password-with-reset", {
        email,
        flow: "reset",
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
          message:
            "No password login exists for this email yet. Create one first, then you can reset it.",
        });
        toast.error("No password login exists for this email yet.");
        return false;
      }
      toast.error("Could not send a password reset code.");
      return false;
    }
  };

  const requestCode = async (flow: UniqueCodeFlow) => {
    if (flow === "reset") {
      await requestResetCode();
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

  if (step === "email") {
    return (
      <AuthEmailForm defaultEmail={email} onSubmit={handleEmailVerification} />
    );
  }

  if (step === "password") {
    return (
      <AuthPasswordForm
        canSignInWithPassword={passwordAccountExists !== false}
        email={email}
        mode={mode}
        onEmailClear={handleEmailClear}
        onForgotPassword={openResetFlow}
        onModeChange={setMode}
        onSignedIn={onSignedIn}
        onUniqueCodeRequest={openOtpFlow}
      />
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
