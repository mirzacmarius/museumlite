"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { CircleAlert, XCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";

interface AuthEmailFormProps {
  defaultEmail: string;
  onSubmit: (email: string) => Promise<void>;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthEmailForm({ defaultEmail, onSubmit }: AuthEmailFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasEmailError = useMemo(
    () => email.length > 0 && !emailRegex.test(email),
    [email],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasEmailError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(email.trim().toLowerCase());
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = email.length === 0 || hasEmailError || isSubmitting;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label
          className="text-xs font-medium text-white/70"
          htmlFor="auth-email"
        >
          Email
        </label>
        <div>
          <Input
            autoComplete="email"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            ref={inputRef}
            required
            type="email"
            value={email}
          />
          {email.length > 0 ? (
            <button
              aria-label="Clear email"
              className="absolute right-3"
              onClick={() => {
                setEmail("");
                inputRef.current?.focus();
              }}
              tabIndex={-1}
              type="button"
            >
              <XCircle className="h-4 w-4 text-white/40" />
            </button>
          ) : null}
        </div>
        {hasEmailError && !isFocused ? (
          <p className="flex items-center gap-1 px-0.5 text-xs text-red-400">
            <CircleAlert className="h-3 w-3" />
            Enter a valid email address.
          </p>
        ) : null}
      </div>

      <Button className="h-10 w-full" disabled={isButtonDisabled} type="submit">
        {isSubmitting ? "Checking..." : "Continue"}
      </Button>
    </form>
  );
}
