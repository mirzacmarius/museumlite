"use client";

import { cn } from "@v1/ui/utils";
import { useI18n } from "@/locales/client";

interface SkipLink {
  href: string;
  label: string;
}

interface SkipNavigationProps {
  links?: SkipLink[];
}

export function SkipNavigation({ links }: SkipNavigationProps) {
  const translate = useI18n();
  const navigationLinks = links ?? [
    {
      href: "#main-content",
      label: translate("untranslatedComponents.labels.skipToMainContent"),
    },
    {
      href: "#search",
      label: translate("untranslatedComponents.labels.skipToSearch"),
    },
  ];

  return (
    <nav
      aria-label={translate("untranslatedComponents.labels.skipNavigation")}
      className="fixed top-0 left-0 z-[200] flex gap-2 p-2"
    >
      {navigationLinks.map((link) => (
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
