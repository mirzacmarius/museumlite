import { Suspense } from "react";
import { PublicObjectPageClient } from "./public-object-page-client";

export { generateMetadata } from "./layout";

export default function PublicObjectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <p className="text-white/60">Loading object…</p>
        </div>
      }
    >
      <PublicObjectPageClient />
    </Suspense>
  );
}
