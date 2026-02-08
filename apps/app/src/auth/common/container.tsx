import type { ReactNode } from "react";

interface FormContainerProps {
  children: ReactNode;
}

export function FormContainer({ children }: FormContainerProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center py-6">
      <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
        {children}
      </div>
    </div>
  );
}
