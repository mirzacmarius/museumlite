"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LocationsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Locations error:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-card p-8 max-w-md text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Failed to load locations
          </h2>
          <p className="text-sm text-muted-foreground">
            We couldn't load your locations. Please try again or return to the
            dashboard.
          </p>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
