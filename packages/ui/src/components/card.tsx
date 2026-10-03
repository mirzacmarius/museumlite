"use client";

import type * as React from "react";
import { useUiLocale } from "../locale";
import { cn } from "../utils";

const Card = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>) => (
  <div
    ref={ref}
    className={cn(
      "bg-card border border-border rounded-xl hover:border-primary/30 hover:ring-1 hover:ring-primary/30 hover:shadow-2xl transition-all duration-300",
      className,
    )}
    {...props}
  />
);
Card.displayName = "Card";

const CardHeader = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
);
CardHeader.displayName = "CardHeader";

const CardTitle = ({
  className,
  children,
  ref,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> &
  React.RefAttributes<HTMLParagraphElement>) => {
  const { messages } = useUiLocale();
  return (
    <h3
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    >
      {children ?? <span className="sr-only">{messages.card.title}</span>}
    </h3>
  );
};
CardTitle.displayName = "CardTitle";

const CardDescription = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> &
  React.RefAttributes<HTMLParagraphElement>) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);
CardDescription.displayName = "CardDescription";

const CardContent = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = ({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
