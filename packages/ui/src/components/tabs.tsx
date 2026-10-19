"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../utils";
import { Highlight, HighlightScope } from "./motion-highlight";

const TabsValueContext = React.createContext<string | undefined>(undefined);

/**
 * Radix tabs whose active indicator slides between triggers on the spring.
 * The root tracks the active value, controlled or not, so each trigger knows
 * whether it holds the indicator.
 */
function Tabs({
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentPropsWithRef<typeof TabsPrimitive.Root>) {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const activeValue = value ?? uncontrolledValue;
  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange],
  );
  return (
    <TabsValueContext value={activeValue}>
      <HighlightScope>
        <TabsPrimitive.Root
          value={activeValue}
          onValueChange={handleValueChange}
          {...props}
        />
      </HighlightScope>
    </TabsValueContext>
  );
}

function TabsList({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        // Isolated so the indicator, behind every label, still sits above the list's background.
        "isolate inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
TabsList.displayName = TabsPrimitive.List.displayName;

function TabsTrigger({
  className,
  indicatorClassName,
  value,
  children,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof TabsPrimitive.Trigger> & {
  indicatorClassName?: string;
}) {
  const activeValue = React.useContext(TabsValueContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      {activeValue === value && (
        <Highlight
          className={cn(
            "bg-background shadow-sm inset-ring inset-ring-input dark:inset-ring-0",
            indicatorClassName,
          )}
        />
      )}
      {children}
    </TabsPrimitive.Trigger>
  );
}
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

function TabsContent({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
