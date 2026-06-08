"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, Ref } from "react";

interface NavLinkProps extends ComponentProps<typeof Link> {
  href: string;
  label: string;
  ref?: Ref<HTMLAnchorElement>;
}

export function NavLink({
  href,
  label,
  className = "",
  ref,
  ...props
}: NavLinkProps) {
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
}
