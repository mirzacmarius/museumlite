"use client";

import Link from "next/link";
import { useScopedI18n } from "@/locales/client";
import { AccountProfileSettings } from "../(dashboard)/settings/account-profile-settings";
import { AccountCredentials } from "./account-credentials";

export function AccountPageClient() {
  const t = useScopedI18n("account");

  return (
    <main className="min-h-svh overflow-y-auto bg-background px-4 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            href="/"
            className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("backToWorkspace")}
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              {t("description")}
            </p>
          </div>
        </header>
        <AccountProfileSettings>
          <AccountCredentials />
        </AccountProfileSettings>
      </div>
    </main>
  );
}
