"use client";

import { useScopedI18n } from "@/locales/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { CheckCircle } from "lucide-react";

interface SingleItemReturnDialogProps {
  disabled: boolean;
  onConfirm: () => void;
}

export function SingleItemReturnDialog({
  disabled,
  onConfirm,
}: SingleItemReturnDialogProps) {
  const t = useScopedI18n("loans.actions");

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled} className="bg-blue-600 hover:bg-blue-700">
          <CheckCircle className="mr-2 size-4" />
          {t("markAsReturned")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("markAsReturned")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("markAsReturnedConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("markAsReturned")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
