"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../utils";

type FormMessageVariant = "error" | "success" | "warning";

interface FormMessageProps {
  children: React.ReactNode;
  variant?: FormMessageVariant;
  className?: string;
  icon?: boolean;
  /** Lets an input reference the message through `aria-describedby`. */
  id?: string;
}

const variantStyles: Record<FormMessageVariant, string> = {
  error: "text-red-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
};

const variantIcons: Record<FormMessageVariant, React.ReactNode> = {
  error: <AlertCircle className="size-3.5" />,
  success: <CheckCircle2 className="size-3.5" />,
  warning: <AlertCircle className="size-3.5" />,
};

export function FormMessage({
  children,
  variant = "error",
  className,
  icon = true,
  id,
}: FormMessageProps) {
  if (!children) return null;

  return (
    <p
      id={id}
      className={cn(
        "flex items-center gap-1.5 text-sm",
        variantStyles[variant],
        className,
      )}
      role={variant === "error" ? "alert" : undefined}
    >
      {icon && variantIcons[variant]}
      {children}
    </p>
  );
}
