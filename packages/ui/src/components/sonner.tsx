"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { useUiLocale } from "../locale";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({
  containerAriaLabel,
  toastOptions,
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const { messages } = useUiLocale();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand={false}
      richColors
      closeButton
      containerAriaLabel={containerAriaLabel ?? messages.sonner.notifications}
      toastOptions={{
        closeButtonAriaLabel: messages.sonner.close,
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border",
          ...toastOptions?.classNames,
        },
      }}
      duration={4000}
      {...props}
    />
  );
};

interface ToastWithUndoOptions {
  message: string;
  description?: string;
  onUndo: () => void | Promise<void>;
  undoLabel?: string;
  duration?: number;
}

const toastWithUndo = ({
  message,
  description,
  onUndo,
  undoLabel = "Undo",
  duration = 5000,
}: ToastWithUndoOptions) => {
  return sonnerToast(message, {
    description,
    duration,
    action: {
      label: undoLabel,
      onClick: onUndo,
    },
  });
};

interface ToastPromiseOptions<T> {
  promise: Promise<T>;
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: Error) => string);
}

const toastPromise = <T,>({
  promise,
  loading,
  success,
  error,
}: ToastPromiseOptions<T>) => {
  return sonnerToast.promise(promise, {
    loading,
    success,
    error,
  });
};

export { Toaster, toastPromise, toastWithUndo };
