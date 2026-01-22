"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ZodError, ZodSchema } from "zod";

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

interface UseFieldValidationOptions<T> {
  schema: ZodSchema<T>;
  debounceMs?: number;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  onValidationComplete?: (isValid: boolean, error?: string) => void;
}

interface UseFieldValidationReturn {
  status: ValidationStatus;
  error: string | null;
  isValid: boolean;
  validate: (value: unknown) => Promise<boolean>;
  handleChange: (value: unknown) => void;
  handleBlur: () => void;
  reset: () => void;
}

export function useFieldValidation<T>({
  schema,
  debounceMs = 300,
  validateOnBlur = true,
  validateOnChange = true,
  onValidationComplete,
}: UseFieldValidationOptions<T>): UseFieldValidationReturn {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState<unknown>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef<unknown>(null);

  const validate = useCallback(
    async (value: unknown): Promise<boolean> => {
      setStatus("validating");
      latestValueRef.current = value;

      try {
        await schema.parseAsync(value);

        if (latestValueRef.current !== value) return false;

        setStatus("valid");
        setError(null);
        onValidationComplete?.(true);
        return true;
      } catch (err) {
        if (latestValueRef.current !== value) return false;

        const zodError = err as ZodError;
        const message = zodError.errors[0]?.message || "Invalid value";
        setStatus("invalid");
        setError(message);
        onValidationComplete?.(false, message);
        return false;
      }
    },
    [schema, onValidationComplete],
  );

  const handleChange = useCallback(
    (value: unknown) => {
      setPendingValue(value);

      if (!validateOnChange) return;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        validate(value);
      }, debounceMs);
    },
    [validate, validateOnChange, debounceMs],
  );

  const handleBlur = useCallback(() => {
    if (!validateOnBlur) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (pendingValue !== null) {
      validate(pendingValue);
    }
  }, [validate, validateOnBlur, pendingValue]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setPendingValue(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    error,
    isValid: status === "valid",
    validate,
    handleChange,
    handleBlur,
    reset,
  };
}
