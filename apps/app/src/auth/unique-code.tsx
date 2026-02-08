"use client";

import { CodeInput } from "@/auth/CodeInput";
import type { UniqueCodeFlow } from "@/auth/types";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { CircleCheck, XCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface AuthUniqueCodeFormProps {
  email: string;
  flow: UniqueCodeFlow;
  onEmailClear: () => void;
  onSignedIn: () => void;
  onRequestCode: (flow: UniqueCodeFlow) => Promise<void>;
}

export function AuthUniqueCodeForm({
  email,
  flow,
  onEmailClear,
  onSignedIn,
  onRequestCode,
}: AuthUniqueCodeFormProps) {
  const { signIn } = useAuthActions();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingNewCode, setIsRequestingNewCode] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setResendTimer((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [resendTimer]);

  const isRequestNewCodeDisabled = isRequestingNewCode || resendTimer > 0;

  const isButtonDisabled = useMemo(() => {
    if (isSubmitting || code.length === 0) {
      return true;
    }

    if (flow === "reset") {
      return newPassword.length < 8;
    }

    return false;
  }, [code, flow, isSubmitting, newPassword.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (flow === "reset") {
        const result = await signIn("password-with-reset", {
          code,
          email,
          flow: "reset-verification",
          newPassword,
        });

        if (result.signingIn) {
          onSignedIn();
          return;
        }

        toast.error("Invalid code or password reset payload.");
        return;
      }

      if (flow === "passwordVerify") {
        const result = await signIn("password-with-reset", {
          code,
          email,
          flow: "email-verification",
        });

        if (result.signingIn) {
          onSignedIn();
          return;
        }

        toast.error("Invalid verification code.");
        return;
      }

      const result = await signIn("resend-otp", { code, email });

      if (result.signingIn) {
        onSignedIn();
        return;
      }

      toast.error("Invalid code.");
    } catch {
      toast.error("Could not verify code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateNewCode = async () => {
    setIsRequestingNewCode(true);
    try {
      await onRequestCode(flow);
      setResendTimer(30);
      setCode("");
    } catch {
      // Toast is already handled in the caller.
    } finally {
      setIsRequestingNewCode(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label
          className="text-xs font-medium text-white/70"
          htmlFor="unique-code-email"
        >
          Email
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
            aria-label="Clear email"
            className="absolute right-3"
            onClick={onEmailClear}
            type="button"
          >
            <XCircle className="h-4 w-4 text-white/40" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <label
          className="text-xs font-medium text-white/70"
          htmlFor="unique-code"
        >
          Unique code
        </label>
        <CodeInput id="unique-code" onChange={setCode} value={code} />
        <div className="flex items-center justify-between px-0.5 pt-1">
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-300">
            <CircleCheck className="h-3 w-3" />
            Paste the code from your email.
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
            {resendTimer > 0
              ? `Resend in ${resendTimer}s`
              : isRequestingNewCode
                ? "Sending..."
                : "Resend"}
          </button>
        </div>
      </div>

      {flow === "reset" ? (
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-white/70"
            htmlFor="reset-password"
          >
            New password
          </label>
          <Input
            autoComplete="new-password"
            className="h-10 border-white/10 bg-background"
            id="reset-password"
            minLength={8}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Set a new password"
            type="password"
            value={newPassword}
          />
        </div>
      ) : null}

      <Button className="h-10 w-full" disabled={isButtonDisabled} type="submit">
        {isSubmitting
          ? "Continuing..."
          : flow === "reset"
            ? "Reset password"
            : "Continue"}
      </Button>
    </form>
  );
}
