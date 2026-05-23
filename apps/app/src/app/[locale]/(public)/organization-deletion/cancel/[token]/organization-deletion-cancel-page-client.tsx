"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Logo } from "@v1/ui/logo";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface PageProps {
  params: Promise<{
    token: string;
    locale: string;
  }>;
}

export function OrganizationDeletionCancelPageClient({ params }: PageProps) {
  const { token, locale: routeLocale } = use(params);
  const locale = useCurrentLocale();
  const t = useScopedI18n("organizationDeletionCancelPage");

  const [error, setError] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deletionInfo = useQuery(api.organizationDeletion.getDeletionByToken, {
    token,
  });
  const cancelDeletion = useMutation(api.organizationDeletion.cancelDeletion);

  const handleCancelDeletion = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await cancelDeletion({ token });
      setIsCancelled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (deletionInfo === undefined) {
    return (
      <div className="size-screen flex flex-col items-center justify-center px-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <p>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (deletionInfo === null) {
    return (
      <div className="size-screen flex flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <Logo width={200} height={200} />
          <XCircle className="size-12 text-destructive" />
          <h1 className="text-2xl font-semibold">{t("notFound")}</h1>
          <p className="text-muted-foreground">{t("notFoundDescription")}</p>
        </div>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="size-screen flex flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <Logo width={200} height={200} />
          <CheckCircle className="size-12 text-primary" />
          <h1 className="text-2xl font-semibold">{t("successTitle")}</h1>
          <p className="text-muted-foreground">{t("successDescription")}</p>
          <Button asChild>
            <Link href={`/${routeLocale}/login`}>{t("signIn")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="size-screen flex flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Logo width={200} height={200} />
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>

        <div className="w-full space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <p className="text-sm text-muted-foreground">{t("organization")}</p>
            <p className="text-base font-medium">{deletionInfo.organizationName}</p>
          </div>
          {deletionInfo.scheduledDeletionDate ? (
            <div>
              <p className="text-sm text-muted-foreground">
                {t("scheduledDeletionDate")}
              </p>
              <p className="text-base">
                {formatDate(
                  new Date(deletionInfo.scheduledDeletionDate),
                  locale,
                )}
              </p>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="flex w-full items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          className="w-full"
          disabled={isSubmitting}
          onClick={handleCancelDeletion}
        >
          {isSubmitting ? t("cancelling") : t("cancelButton")}
        </Button>
      </div>
    </div>
  );
}
