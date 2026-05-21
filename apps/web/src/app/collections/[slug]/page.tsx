import { Suspense } from "react";
import { PublicCollectionPageClient } from "./public-collection-page-client";

export default function PublicCollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <p className="text-white/60">Loading collection…</p>
        </div>
      }
    >
      <PublicCollectionPageClient />
    </Suspense>
  );
}
