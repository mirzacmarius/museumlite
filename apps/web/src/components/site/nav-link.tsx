"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, type ComponentProps } from "react";

interface NavLinkProps extends ComponentProps<typeof Link> {
  href: string;
  label: string;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function NavLink({ href, label, className = "", ...props }, ref) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
      <Link
        ref={ref}
        href={href}
        className={`hover:text-gold transition-colors ${isActive ? "text-gold" : ""} ${className}`}
        {...props}
      >
        {label}
      </Link>
    );
  },
);
