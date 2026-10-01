import { Suspense } from "react";
import { AccountPageClient } from "./page-client";

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-background px-4 py-8 sm:px-8 sm:py-12">
          <div className="mx-auto h-64 w-full max-w-4xl animate-pulse rounded-lg bg-card" />
        </main>
      }
    >
      <AccountPageClient />
    </Suspense>
  );
}
