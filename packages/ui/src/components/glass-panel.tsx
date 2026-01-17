import * as React from "react";
import { cn } from "../utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "sm" | "md" | "lg";
}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className, padding = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-card/40 backdrop-blur-xl border border-border/60 rounded-xl",
          {
            "p-2": padding === "sm",
            "p-4": padding === "md",
            "p-6": padding === "lg",
          },
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassPanel.displayName = "GlassPanel";

export { GlassPanel, type GlassPanelProps };
