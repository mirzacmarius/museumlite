import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "btn-marketing inline-flex items-center justify-center text-xs uppercase tracking-[0.3em] transition-colors";

export function PrimaryButton({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`${base} border border-gold bg-gold/95 px-6 py-4 text-ink hover:bg-transparent hover:text-gold ${className}`}
      {...props}
    />
  );
}

export function SecondaryButton({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`${base} border border-ivory/40 px-6 py-4 text-ivory hover:border-gold hover:text-gold ${className}`}
      {...props}
    />
  );
}
