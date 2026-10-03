"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducer } from "react";
import { AuthHeader } from "@/auth/auth-header";
import { FormContainer } from "@/auth/common/container";
import { AuthFormRoot } from "@/auth/form-root";
import { SignInWithOAuth } from "@/auth/SignInWithOAuth";
import { buildAuthPath } from "@/auth/search-params";
import type {
  AuthErrorInfo,
  AuthMode,
  AuthStep,
  UniqueCodeFlow,
} from "@/auth/types";
import { useCurrentLocale, useI18n } from "@/locales/client";

interface AuthRootProps {
  initialMode: AuthMode;
  initialEmail?: string;
  redirectTo?: string;
}

interface AuthRootInit {
  initialMode: AuthMode;
  initialEmail?: string;
}

interface AuthRootState {
  mode: AuthMode;
  step: AuthStep;
  email: string;
  errorInfo: AuthErrorInfo | undefined;
  codeFlow: UniqueCodeFlow;
}

type AuthRootAction =
  | { type: "setMode"; value: AuthMode }
  | { type: "setStep"; value: AuthStep }
  | { type: "setEmail"; value: string }
  | { type: "setErrorInfo"; value: AuthErrorInfo | undefined }
  | { type: "setCodeFlow"; value: UniqueCodeFlow };

interface AuthModeSwitchLinkProps {
  email: string;
  mode: AuthMode;
  redirectTo?: string;
}

function createInitialAuthRootState({
  initialEmail,
  initialMode,
}: AuthRootInit): AuthRootState {
  return {
    mode: initialMode,
    step: "email",
    email: initialEmail ?? "",
    errorInfo: undefined,
    codeFlow: "otp",
  };
}

function authRootReducer(
  state: AuthRootState,
  action: AuthRootAction,
): AuthRootState {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.value };
    case "setStep":
      return { ...state, step: action.value };
    case "setEmail":
      return { ...state, email: action.value };
    case "setErrorInfo":
      return { ...state, errorInfo: action.value };
    case "setCodeFlow":
      return { ...state, codeFlow: action.value };
  }
}

function AuthModeSwitchLink({
  email,
  mode,
  redirectTo,
}: AuthModeSwitchLinkProps) {
  const translate = useI18n();
  const nextMode = mode === "signIn" ? "signUp" : "signIn";
  const href = buildAuthPath(nextMode === "signIn" ? "/login" : "/register", {
    email: email || undefined,
    returnTo: redirectTo,
  });

  return (
    <p className="pt-5 text-center text-sm text-muted-foreground">
      {mode === "signIn"
        ? translate("untranslatedComponents.auth.noAccountYet")
        : translate("untranslatedComponents.auth.alreadyHaveAccount")}{" "}
      <Link
        className="font-medium text-foreground underline underline-offset-4"
        href={href}
      >
        {mode === "signIn"
          ? translate("untranslatedComponents.auth.createOne")
          : translate("untranslatedComponents.auth.signIn")}
      </Link>
    </p>
  );
}

export function AuthRoot({
  initialEmail,
  initialMode,
  redirectTo,
}: AuthRootProps) {
  const locale = useCurrentLocale();
  const { push, refresh } = useRouter();

  const [state, dispatch] = useReducer(
    authRootReducer,
    { initialEmail, initialMode },
    createInitialAuthRootState,
  );

  const handleSignedIn = () => {
    push(redirectTo ?? `/${locale}`);
    refresh();
  };

  return (
    <FormContainer>
      {state.errorInfo ? (
        <div className="rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {state.errorInfo.message}
        </div>
      ) : null}

      <AuthHeader mode={state.mode} step={state.step} />

      <SignInWithOAuth
        compact={state.step === "password"}
        redirectTo={redirectTo}
        showDivider
      />

      <AuthFormRoot
        codeFlow={state.codeFlow}
        currentAuthMode={initialMode}
        email={state.email}
        mode={state.mode}
        onSignedIn={handleSignedIn}
        setCodeFlow={(flow) => dispatch({ type: "setCodeFlow", value: flow })}
        setEmail={(email) => dispatch({ type: "setEmail", value: email })}
        setErrorInfo={(errorInfo) =>
          dispatch({ type: "setErrorInfo", value: errorInfo })
        }
        setMode={(mode) => dispatch({ type: "setMode", value: mode })}
        setStep={(step) => dispatch({ type: "setStep", value: step })}
        step={state.step}
      />
      <AuthModeSwitchLink
        email={state.email}
        mode={state.mode}
        redirectTo={redirectTo}
      />
    </FormContainer>
  );
}
