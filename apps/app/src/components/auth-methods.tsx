"use client";

import { GoogleSignin } from "@/components/google-signin";
import { useCurrentLocale } from "@/locales/client";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

interface AuthMethodsProps {
  mode: "signIn" | "signUp";
  redirectTo?: string;
}

export function AuthMethods({ mode, redirectTo }: AuthMethodsProps) {
  const locale = useCurrentLocale();
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignIn = mode === "signIn";
  const switchPath = isSignIn ? "/register" : "/login";
  const switchHref = useMemo(() => {
    if (!redirectTo) {
      return switchPath;
    }
    const params = new URLSearchParams({
      returnTo: redirectTo,
    });
    return `${switchPath}?${params.toString()}`;
  }, [redirectTo, switchPath]);

  const submitLabel = isSignIn ? "Sign in with email" : "Create account";
  const submitLoadingLabel = isSignIn ? "Signing in..." : "Creating account...";
  const googleLabel = isSignIn ? "Sign in with Google" : "Sign up with Google";
  const switchPrompt = isSignIn
    ? "Don't have an account?"
    : "Already have an account?";
  const switchAction = isSignIn ? "Create account" : "Sign in";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfo(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("password", {
        email,
        password,
        flow: mode,
        ...(redirectTo ? { redirectTo } : {}),
      });

      if (!result.signingIn) {
        setInfo("Check your email for a verification link to finish sign-in.");
        return;
      }

      router.push(redirectTo ?? `/${locale}`);
      router.refresh();
    } catch (signInError) {
      if (
        signInError instanceof Error &&
        signInError.message.includes("reading 'redirect'")
      ) {
        setError(
          "Auth service is out of sync. Restart the app and Convex dev servers, then try again.",
        );
        return;
      }

      setError(
        signInError instanceof Error
          ? signInError.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-4">
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            placeholder="At least 8 characters"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {info ? <p className="text-sm text-white/70">{info}</p> : null}
        <Button
          type="submit"
          className="w-full font-mono"
          disabled={isSubmitting}
        >
          {isSubmitting ? submitLoadingLabel : submitLabel}
        </Button>
      </form>

      <p className="text-center text-xs text-white/60">or</p>

      <GoogleSignin redirectTo={redirectTo} label={googleLabel} />

      <p className="text-center text-sm text-white/70">
        {switchPrompt}{" "}
        <Link
          href={switchHref}
          className="text-white underline underline-offset-4"
        >
          {switchAction}
        </Link>
      </p>
    </div>
  );
}
