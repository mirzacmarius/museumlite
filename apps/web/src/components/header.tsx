"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { Logo } from "@v1/ui/logo";
import Link from "next/link";
import { SubscribeForm } from "./subscribe-form";

export function Header() {
  return (
    <header className="fixed top-0 w-full flex items-center justify-between p-4 z-50 bg-background/80 backdrop-blur-sm border-b border-border/40">
      <Link href="/" className="flex items-center gap-2">
        <Logo className="size-10 md:size-12" />
        <span className="font-departure text-lg md:text-xl">MuseumLite</span>
      </Link>

      <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
        <Link
          href="#features"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Features
        </Link>
        <Link
          href="#use-cases"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Use Cases
        </Link>
        <Link
          href="#pricing"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Pricing
        </Link>
        <Link
          href="#faq"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          FAQ
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <a
          href={`${process.env.NEXT_PUBLIC_APP_URL}/login`}
          className="hidden sm:block text-sm px-4 py-2 text-primary hover:text-foreground transition-colors font-medium"
        >
          Sign in
        </a>
        <a
          href={`${process.env.NEXT_PUBLIC_APP_URL}/register`}
          className="text-sm px-4 py-2 bg-primary text-secondary rounded-full font-medium hover:opacity-90 transition-opacity"
        >
          Start Free
        </a>
      </div>
    </header>
  );
}
