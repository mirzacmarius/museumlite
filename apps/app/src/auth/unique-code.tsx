"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { CircleCheck, XCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useReducer } from "react";
import { toast } from "sonner";
import { CodeInput } from "@/auth/CodeInput";
import type { UniqueCodeFlow } from "@/auth/types";
import { useI18n } from "@/locales/client";

interface AuthUniqueCodeFormProps {
  email: string;
  flow: UniqueCodeFlow;
  onEmailClear: () => void;
  onSignedIn: () => void;
  onRequestCode: (flow: UniqueCodeFlow) => Promise<void>;
}

interface UniqueCodeFormState {
  code: string;
  newPassword: string;
  isSubmitting: boolean;
  isRequestingNewCode: boolean;
  resendTimer: number;
}

type UniqueCodeFormAction =
  | { type: "setCode"; value: string }
  | { type: "setNewPassword"; value: string }
  | { type: "setIsSubmitting"; value: boolean }
  | { type: "setIsRequestingNewCode"; value: boolean }
  | { type: "setResendTimer"; value: number }
  | { type: "decrementResendTimer" }
  | { type: "resetAfterResend" };

const initialUniqueCodeFormState: UniqueCodeFormState = {
  code: "",
  newPassword: "",
  isSubmitting: false,
  isRequestingNewCode: false,
  resendTimer: 0,
};

function uniqueCodeFormReducer(
  state: UniqueCodeFormState,
  action: UniqueCodeFormAction,
): UniqueCodeFormState {
  switch (action.type) {
    case "setCode":
      return { ...state, code: action.value };
    case "setNewPassword":
      return { ...state, newPassword: action.value };
    case "setIsSubmitting":
      return { ...state, isSubmitting: action.value };
    case "setIsRequestingNewCode":
      return { ...state, isRequestingNewCode: action.value };
    case "setResendTimer":
      return { ...state, resendTimer: action.value };
    case "decrementResendTimer":
      return { ...state, resendTimer: Math.max(0, state.resendTimer - 1) };
    case "resetAfterResend":
      return { ...state, resendTimer: 30, code: "" };
  }
}

export function AuthUniqueCodeForm({
  email,
  flow,
  onEmailClear,
  onSignedIn,
  onRequestCode,
}: AuthUniqueCodeFormProps) {
  const translate = useI18n();
  const { signIn } = useAuthActions();
  const [state, dispatch] = useReducer(
    uniqueCodeFormReducer,
    initialUniqueCodeFormState,
  );

  useEffect(() => {
    if (state.resendTimer <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: "decrementResendTimer" });
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [state.resendTimer]);

  const isRequestNewCodeDisabled =
    state.isRequestingNewCode || state.resendTimer > 0;

  const isButtonDisabled = useMemo(() => {
    if (state.isSubmitting || state.code.length === 0) {
      return true;
    }

    if (flow === "reset") {
      return state.newPassword.length < 8;
    }

    return false;
  }, [flow, state.code, state.isSubmitting, state.newPassword.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: "setIsSubmitting", value: true });

    try {
      if (flow === "reset") {
        const result = await signIn("password-with-reset", {
          code: state.code,
          email,
          flow: "reset-verification",
          newPassword: state.newPassword,
        });

        if (result.signingIn) {
          onSignedIn();
          return;
        }

        toast.error(
          translate("untranslatedComponents.auth.invalidCodeOrResetPayload"),
        );
        return;
      }

      if (flow === "passwordVerify") {
        const result = await signIn("password-with-reset", {
          code: state.code,
          email,
          flow: "email-verification",
        });

        if (result.signingIn) {
          onSignedIn();
          return;
        }

        toast.error(
          translate("untranslatedComponents.auth.invalidVerificationCode"),
        );
        return;
      }

      const result = await signIn("resend-otp", { code: state.code, email });

      if (result.signingIn) {
        onSignedIn();
        return;
      }

      toast.error(translate("untranslatedComponents.auth.invalidCode"));
    } catch {
      toast.error(
        translate("untranslatedComponents.auth.codeVerificationFailed"),
      );
    } finally {
      dispatch({ type: "setIsSubmitting", value: false });
    }
  };

  const generateNewCode = async () => {
    dispatch({ type: "setIsRequestingNewCode", value: true });
    try {
      await onRequestCode(flow);
      dispatch({ type: "resetAfterResend" });
    } catch {
      // Toast is already handled in the caller.
    } finally {
      dispatch({ type: "setIsRequestingNewCode", value: false });
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label
          className="text-xs font-medium text-white/70"
          htmlFor="unique-code-email"
        >
          {translate("untranslatedComponents.labels.email")}
        </label>
        <div className="relative flex items-center rounded-md border border-white/10 bg-background">
          <Input
            className="h-10 border-0 pr-10 text-white/75"
            disabled
            id="unique-code-email"
            type="email"
            value={email}
          />
          <button
            aria-label={translate("untranslatedComponents.labels.clearEmail")}
            className="absolute right-3"
            onClick={onEmailClear}
            type="button"
          >
            <XCircle className="size-4 text-white/40" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label
          className="text-xs font-medium text-white/70"
          htmlFor="unique-code"
        >
          {translate("untranslatedComponents.labels.uniqueCode")}
        </label>
        <CodeInput
          id="unique-code"
          onChange={(value) => dispatch({ type: "setCode", value })}
          value={state.code}
        />
        <div className="flex items-center justify-between px-0.5 pt-1">
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-300">
            <CircleCheck className="size-3" />
            {translate(
              "untranslatedComponents.labels.pasteTheCodeFromYourEmail",
            )}
          </p>
          <button
            className={`text-xs font-medium ${
              isRequestNewCodeDisabled
                ? "cursor-not-allowed text-white/40"
                : "text-white/70 hover:text-white"
            }`}
            disabled={isRequestNewCodeDisabled}
            onClick={generateNewCode}
            type="button"
          >
            {state.resendTimer > 0
              ? translate("untranslatedComponents.auth.resendInSeconds", {
                  seconds: state.resendTimer,
                })
              : state.isRequestingNewCode
                ? translate("untranslatedComponents.auth.sending")
                : translate("untranslatedComponents.auth.resend")}
          </button>
        </div>
      </div>

      {flow === "reset" ? (
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-white/70"
            htmlFor="reset-password"
          >
            {translate("untranslatedComponents.labels.newPassword")}
          </label>
          <Input
            autoComplete="new-password"
            className="h-10 border-white/10 bg-background"
            id="reset-password"
            minLength={8}
            onChange={(event) =>
              dispatch({ type: "setNewPassword", value: event.target.value })
            }
            placeholder={translate(
              "untranslatedComponents.labels.setANewPassword",
            )}
            type="password"
            value={state.newPassword}
          />
        </div>
      ) : null}

      <Button className="h-10 w-full" disabled={isButtonDisabled} type="submit">
        {state.isSubmitting
          ? translate("untranslatedComponents.auth.continuing")
          : flow === "reset"
            ? translate("untranslatedComponents.auth.resetPassword")
            : translate("untranslatedComponents.auth.continue")}
      </Button>
    </form>
  );
}
