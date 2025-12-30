import { StatusBadge, type StatusBadgeProps } from "@v1/ui/status-badge";
import { cn } from "@v1/ui/utils";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface CollectionCardProps {
  title: string;
  subtitle: string;
  imageSrc: string;
  href: string;
  variant:
    | "amber"
    | "rose"
    | "cyan"
    | "purple"
    | "emerald"
    | "indigo"
    | "blue"
    | "zinc";
  statusText: string;
  statusIcon?: StatusBadgeProps["icon"];
  footer?: ReactNode;
  animationDelay?: number;
}

export function CollectionCard({
  title,
  subtitle,
  imageSrc,
  href,
  variant,
  statusText,
  statusIcon,
  footer,
  animationDelay = 0,
}: CollectionCardProps) {
  const glowClasses = {
    amber:
      "hover:border-amber-500/30 hover:ring-amber-500/30 hover:shadow-amber-900/10",
    rose: "hover:border-rose-500/30 hover:ring-rose-500/30 hover:shadow-rose-900/10",
    cyan: "hover:border-cyan-500/30 hover:ring-cyan-500/30 hover:shadow-cyan-900/10",
    purple:
      "hover:border-purple-500/30 hover:ring-purple-500/30 hover:shadow-purple-900/10",
    emerald:
      "hover:border-emerald-500/30 hover:ring-emerald-500/30 hover:shadow-emerald-900/10",
    indigo:
      "hover:border-indigo-500/30 hover:ring-indigo-500/30 hover:shadow-indigo-900/10",
    blue: "hover:border-blue-500/30 hover:ring-blue-500/30 hover:shadow-blue-900/10",
    zinc: "hover:border-zinc-500/30 hover:ring-zinc-500/30 hover:shadow-zinc-900/10",
  };

  return (
    <Link
      href={href}
      className={cn(
        "hover-trigger group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 shadow-lg transition-all duration-300 hover:shadow-2xl hover:ring-1 animate-enter",
        glowClasses[variant],
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="relative aspect-[2/1] overflow-hidden bg-zinc-900">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-90" />

        <img
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover opacity-60 transition-transform duration-700 ease-out will-change-transform group-hover:scale-105 group-hover:opacity-80"
        />

        <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
          <button
            type="button"
            className="rounded-md border border-zinc-800 bg-zinc-950/80 p-1.5 text-zinc-400 backdrop-blur-md hover:text-white"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="absolute top-2 left-2 z-20">
          <StatusBadge variant={variant} icon={statusIcon}>
            {statusText}
          </StatusBadge>
        </div>

        <div className="absolute bottom-3 left-3 right-3 z-20">
          <h3 className="text-sm font-semibold leading-snug tracking-tight text-white drop-shadow-md">
            {title}
          </h3>
          <p className="truncate text-[11px] text-zinc-300 opacity-90">
            {subtitle}
          </p>
        </div>
      </div>

      {footer && (
        <div className="flex flex-1 flex-col justify-end bg-zinc-900/20 p-3">
          <div className="border-t border-zinc-800/50 pt-2 text-[11px] text-zinc-500">
            {footer}
          </div>
        </div>
      )}
    </Link>
  );
}
