import { Button } from "@v1/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";

interface EditLoanLockedViewProps {
  loanId: string;
  status: string;
}

export function EditLoanLockedView({
  loanId,
  status,
}: EditLoanLockedViewProps) {
  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-md flex-col items-center justify-center gap-6">
        <div className="rounded-full bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500">
          <Lock className="size-6" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">Loan Locked</h1>
          <p className="text-muted-foreground mt-2 max-w-sm">
            This loan is currently{" "}
            <span className="font-medium text-foreground">{status}</span> and
            cannot be edited. Only pending loans can be modified.
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link href={`/loans/${loanId}`}>Return to Loan Details</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
