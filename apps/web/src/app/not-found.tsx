import Link from "next/link";
import "@/marketing-styles.css";
import { MarketingSiteRoot } from "@/components/site/marketing-site-root";
import { MarketingSiteShell } from "@/components/site/marketing-site-shell";

export default function NotFound() {
  return (
    <MarketingSiteRoot>
      <MarketingSiteShell>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="text-7xl font-semibold text-foreground">404</h1>
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              Page not found
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved.
            </p>
            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      </MarketingSiteShell>
    </MarketingSiteRoot>
  );
}
