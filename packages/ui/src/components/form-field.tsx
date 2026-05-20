"use client";

import * as React from "react";
import { cn } from "../utils";
import { Label } from "./label";

interface FormFieldContextValue {
  id: string;
  error?: string;
  required?: boolean;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
  null,
);

function useFormField() {
  const context = React.use(FormFieldContext);
  if (!context) {
    throw new Error("useFormField must be used within a FormField");
  }
  return context;
}

interface FormFieldProps {
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

function FormField({ children, error, required, className }: FormFieldProps) {
  const id = React.useId();

  return (
    <FormFieldContext.Provider value={{ id, error, required }}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </FormFieldContext.Provider>
  );
}

interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  children: React.ReactNode;
}

function FormLabel({ children, className, ...props }: FormLabelProps) {
  const { id, required } = useFormField();

  return (
    <Label htmlFor={id} className={className} {...props}>
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </Label>
  );
}

function useFormControlProps() {
  const { id, error } = useFormField();
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className: error ? "border-red-500 focus-visible:ring-red-500" : undefined,
  };
}

interface FormErrorProps {
  className?: string;
}

function FormError({ className }: FormErrorProps) {
  const { id, error } = useFormField();

  if (!error) return null;

  return (
    <p
      id={`${id}-error`}
      className={cn("text-sm text-red-500", className)}
      role="alert"
    >
      {error}
    </p>
  );
}

interface FormDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

function FormDescription({ children, className }: FormDescriptionProps) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>{children}</p>
  );
}

export {
  FormField,
  FormLabel,
  FormError,
  FormDescription,
  useFormField,
  useFormControlProps,
};
