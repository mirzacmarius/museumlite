"use client";

import { SignInWithOAuth } from "@/auth/SignInWithOAuth";
import { AuthHeader } from "@/auth/auth-header";
import { FormContainer } from "@/auth/common/container";
import { AuthFormRoot } from "@/auth/form-root";
import type {
  AuthErrorInfo,
  AuthMode,
  AuthStep,
  UniqueCodeFlow,
} from "@/auth/types";
import { useCurrentLocale } from "@/locales/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AuthRootProps {
  initialMode: AuthMode;
  redirectTo?: string;
}

export function AuthRoot({ initialMode, redirectTo }: AuthRootProps) {
  const locale = useCurrentLocale();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [errorInfo, setErrorInfo] = useState<AuthErrorInfo>();
  const [codeFlow, setCodeFlow] = useState<UniqueCodeFlow>("otp");

  const handleSignedIn = () => {
    router.push(redirectTo ?? `/${locale}`);
    router.refresh();
  };

  return (
    <FormContainer>
      {errorInfo ? (
        <div className="rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorInfo.message}
        </div>
      ) : null}

      <AuthHeader mode={mode} />

      <SignInWithOAuth
        compact={step === "password"}
        redirectTo={redirectTo}
        showDivider
      />

      <AuthFormRoot
        codeFlow={codeFlow}
        currentAuthMode={initialMode}
        email={email}
        mode={mode}
        onSignedIn={handleSignedIn}
        setCodeFlow={setCodeFlow}
        setEmail={setEmail}
        setErrorInfo={setErrorInfo}
        setMode={setMode}
        setStep={setStep}
        step={step}
      />
    </FormContainer>
  );
}
