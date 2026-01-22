import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@v1/ui/utils";

interface InlineLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

const InlineLoader = React.forwardRef<HTMLDivElement, InlineLoaderProps>(
  ({ className, size = "md", text, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-center gap-2", className)}
        {...props}
      >
        <Loader2
          className={cn(
            "animate-spin text-muted-foreground",
            sizeClasses[size],
          )}
        />
        {text && <span className="text-sm text-muted-foreground">{text}</span>}
      </div>
    );
  },
);
InlineLoader.displayName = "InlineLoader";

interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  text?: string;
}

const PageLoader = React.forwardRef<HTMLDivElement, PageLoaderProps>(
  ({ className, text, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center",
          className,
        )}
        {...props}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          {text && (
            <span className="text-sm text-muted-foreground">{text}</span>
          )}
        </div>
      </div>
    );
  },
);
PageLoader.displayName = "PageLoader";

export { InlineLoader, PageLoader };
