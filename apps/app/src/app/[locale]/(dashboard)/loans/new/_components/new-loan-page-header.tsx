"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { useI18n } from "@/locales/client";
export function NewLoanPageHeader() {
  const tRoot = useI18n();
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href="/loans">
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="text-muted-foreground">{tRoot("loans.title")}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground">
          {tRoot("loans.newLoan")}
        </span>
      </div>
    </header>
  );
}
