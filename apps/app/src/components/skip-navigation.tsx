"use client";

import { cn } from "@v1/ui/utils";

interface SkipLink {
  href: string;
  label: string;
}

const defaultSkipLinks: SkipLink[] = [
  { href: "#main-content", label: "Skip to main content" },
  { href: "#search", label: "Skip to search" },
];

interface SkipNavigationProps {
  links?: SkipLink[];
}

export function SkipNavigation({
  links = defaultSkipLinks,
}: SkipNavigationProps) {
  return (
    <nav
      aria-label="Skip navigation"
      className="fixed top-0 left-0 z-[200] flex gap-2 p-2"
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            "sr-only focus:not-sr-only",
            "focus:absolute focus:z-[200]",
            "bg-primary text-primary-foreground",
            "px-4 py-2 rounded-md text-sm font-medium",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "transition-all",
          )}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
