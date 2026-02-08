"use client";

import type { AuthMode } from "@/auth/types";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Eye, EyeOff, XCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface AuthPasswordFormProps {
  canSignInWithPassword: boolean;
  email: string;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onEmailClear: () => void;
  onUniqueCodeRequest: () => Promise<void>;
  onForgotPassword: () => Promise<void>;
  onPasswordVerificationRequired: () => void;
  onSignedIn: () => void;
}

export function AuthPasswordForm({
  canSignInWithPassword,
  email,
  mode,
  onModeChange,
  onEmailClear,
  onUniqueCodeRequest,
  onForgotPassword,
  onPasswordVerificationRequired,
  onSignedIn,
}: AuthPasswordFormProps) {
  const { signIn } = useAuthActions();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRetypePassword, setShowRetypePassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = mode === "signUp";

  const isButtonDisabled = useMemo(() => {
    if (isSubmitting || password.length === 0) {
      return true;
    }

    if (!isSignUp) {
      return false;
    }

    return confirmPassword.length === 0 || password !== confirmPassword;
  }, [confirmPassword, isSignUp, isSubmitting, password]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "signIn" && !canSignInWithPassword) {
      onModeChange("signUp");
      toast.error(
        "No password login exists for this email yet. Create one first.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn("password-with-reset", {
        email,
        flow: mode,
        password,
      });

      if (result.signingIn) {
        onSignedIn();
        return;
      }

      onPasswordVerificationRequired();
      toast.success("Enter the verification code sent to your email.");
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes("InvalidAccountId") && !isSignUp) {
        onModeChange("signUp");
        toast.error(
          "No password login exists for this email yet. Create one first.",
        );
      } else {
        toast.error(
          isSignUp
            ? "Could not create account with this email."
            : "Could not sign in with that password.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label
          className="text-xs font-medium text-white/70"
          htmlFor="auth-email-disabled"
        >
          Email
        </label>
        <div className="relative flex items-center rounded-md border border-white/10 bg-background">
          <Input
            className="h-10 border-0 pr-10 text-white/75"
            disabled
            id="auth-email-disabled"
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
          htmlFor="auth-password"
        >
          {isSignUp ? "Set password" : "Password"}
        </label>
        <div className="relative flex items-center rounded-md">
          <Input
            autoComplete={isSignUp ? "new-password" : "current-password"}
            autoFocus
            className="h-10 border-white/10 bg-background pr-10"
            id="auth-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-white/40" />
            ) : (
              <Eye className="h-4 w-4 text-white/40" />
            )}
          </button>
        </div>
        {mode === "signIn" ? (
          <button
            className="text-xs font-medium text-white/70 transition-colors hover:text-white"
            onClick={() => {
              void onForgotPassword();
            }}
            type="button"
          >
            Forgot password?
          </button>
        ) : null}
      </div>

      {isSignUp ? (
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-white/70"
            htmlFor="auth-confirm-password"
          >
            Confirm password
          </label>
          <div className="relative flex items-center rounded-md">
            <Input
              autoComplete="new-password"
              className="h-10 border-white/10 bg-background pr-10"
              id="auth-confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Retype your password"
              type={showRetypePassword ? "text" : "password"}
              value={confirmPassword}
            />
            <button
              aria-label={
                showRetypePassword ? "Hide password" : "Show password"
              }
              className="absolute right-3"
              onClick={() => setShowRetypePassword((value) => !value)}
              type="button"
            >
              {showRetypePassword ? (
                <EyeOff className="h-4 w-4 text-white/40" />
              ) : (
                <Eye className="h-4 w-4 text-white/40" />
              )}
            </button>
          </div>
          {confirmPassword.length > 0 && confirmPassword !== password ? (
            <p className="px-0.5 text-xs text-red-400">
              Passwords do not match.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2.5">
        <Button
          className="h-10 w-full"
          disabled={isButtonDisabled}
          type="submit"
        >
          {isSubmitting
            ? "Continuing..."
            : mode === "signIn"
              ? "Continue"
              : "Create account"}
        </Button>
        {mode === "signIn" ? (
          <Button
            className="h-10 w-full"
            onClick={() => {
              void onUniqueCodeRequest();
            }}
            type="button"
            variant="secondary"
          >
            Sign in with unique code
          </Button>
        ) : null}
      </div>
    </form>
  );
}
