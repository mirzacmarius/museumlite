import { Button } from "@v1/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/locales/client";

interface EditLoanLockedViewProps {
  loanId: string;
  status: string;
}

export function EditLoanLockedView({
  loanId,
  status,
}: EditLoanLockedViewProps) {
  const tRoot = useI18n();
  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-md flex-col items-center justify-center gap-6">
        <div className="rounded-full bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500">
          <Lock className="size-6" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">
            {tRoot("untranslatedRecords.loans.edit.lockedTitle")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-sm">
            {tRoot("loans.actions.loanLockedDesc", {
              status,
            })}
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link href={`/loans/${loanId}`}>
              {tRoot("untranslatedRecords.loans.edit.returnToDetails")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
