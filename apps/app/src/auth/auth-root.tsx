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
import { useReducer } from "react";

interface AuthRootProps {
  initialMode: AuthMode;
  redirectTo?: string;
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

function createInitialAuthRootState(initialMode: AuthMode): AuthRootState {
  return {
    mode: initialMode,
    step: "email",
    email: "",
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

export function AuthRoot({ initialMode, redirectTo }: AuthRootProps) {
  const locale = useCurrentLocale();
  const { push, refresh } = useRouter();

  const [state, dispatch] = useReducer(
    authRootReducer,
    initialMode,
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

      <AuthHeader mode={state.mode} />

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
    </FormContainer>
  );
}
