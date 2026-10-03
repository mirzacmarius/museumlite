"use client";

import { Button } from "@v1/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useWebI18n } from "@/locales/provider";

interface PortalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PortalError({ error, reset }: PortalErrorProps) {
  const { t } = useWebI18n();
  useEffect(() => {
    console.error("Public portal render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-12 text-center">
      <AlertTriangle className="mb-4 size-12 text-white/40" />
      <h1 className="text-xl font-semibold text-white">
        {t("common.portalNotFound")}
      </h1>
      <p className="mt-2 max-w-md text-sm text-white/60">
        {t("common.portalLoadError")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} variant="secondary">
          {t("common.reload")}
        </Button>
        <Button asChild variant="outline" className="border-white/20">
          <Link href="/">{t("common.backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
