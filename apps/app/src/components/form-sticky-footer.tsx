import type { ReactNode } from "react";

interface FormStickyFooterProps {
  children: ReactNode;
}

export function FormStickyFooter({ children }: FormStickyFooterProps) {
  return (
    <div className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {children}
      </div>
    </div>
  );
}

function FormStickyFooterStatus({ children }: { children: ReactNode }) {
  return <div className="text-sm">{children}</div>;
}

function FormStickyFooterActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-3">{children}</div>;
}

FormStickyFooter.Status = FormStickyFooterStatus;
FormStickyFooter.Actions = FormStickyFooterActions;
