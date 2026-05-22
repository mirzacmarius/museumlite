"use client";

import { Logo } from "@v1/ui/logo";
import Link from "next/link";

export function Header() {
  return (
    <header className="fixed top-0 w-full flex items-center justify-between px-6 md:px-12 py-4 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/[0.06]">
      <Link href="/" className="flex items-center gap-2">
        <Logo className="size-8 md:size-9" />
        <span className="font-departure text-base md:text-lg tracking-tight">
          MuseumLite
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
        <Link
          href="#features"
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          Features
        </Link>
        <Link
          href="#use-cases"
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          Use Cases
        </Link>
        <Link
          href="#pricing"
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          Pricing
        </Link>
        <Link
          href="#faq"
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          FAQ
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <a
          href={`${process.env.NEXT_PUBLIC_APP_URL}/login`}
          className="hidden sm:block text-sm px-4 py-2 text-zinc-400 hover:text-white transition-colors font-medium"
        >
          Sign in
        </a>
        <a
          href={`${process.env.NEXT_PUBLIC_APP_URL}/register`}
          className="text-sm px-5 py-2 bg-white text-zinc-950 rounded-full font-medium hover:bg-zinc-200 transition-colors active:scale-[0.98]"
        >
          Start Free
        </a>
      </div>
    </header>
  );
}
