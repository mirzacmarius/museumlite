"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "../utils";

type FieldStatus = "idle" | "validating" | "valid" | "invalid";

interface FieldStatusIndicatorProps {
  status: FieldStatus;
  className?: string;
}

export function FieldStatusIndicator({
  status,
  className,
}: FieldStatusIndicatorProps) {
  if (status === "idle") return null;

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      aria-hidden="true"
    >
      {status === "validating" && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      {status === "valid" && <Check className="size-4 text-emerald-500" />}
      {status === "invalid" && <AlertCircle className="size-4 text-red-500" />}
    </span>
  );
}
