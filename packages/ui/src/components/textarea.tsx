"use client";

import * as React from "react";
import { cn } from "../utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean;
  maxAutoResizeHeight?: number;
  ref?: React.Ref<HTMLTextAreaElement>;
}

function Textarea({
  autoResize = false,
  className,
  maxAutoResizeHeight,
  onChange,
  ref,
  ...props
}: TextareaProps) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = React.useCallback(() => {
    const textarea = innerRef.current;

    if (!textarea || !autoResize) {
      return;
    }

    const existingCssText = textarea.style.cssText;
    textarea.style.cssText = `${existingCssText};height:auto;`;

    const nextHeight = maxAutoResizeHeight
      ? Math.min(textarea.scrollHeight, maxAutoResizeHeight)
      : textarea.scrollHeight;

    const overflowY =
      maxAutoResizeHeight && textarea.scrollHeight > maxAutoResizeHeight
        ? "auto"
        : "hidden";
    textarea.style.cssText = `${existingCssText};height:${nextHeight}px;overflow-y:${overflowY};`;
  }, [autoResize, maxAutoResizeHeight]);

  React.useEffect(() => {
    resizeTextarea();
  }, [props.defaultValue, props.value, resizeTextarea]);

  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        autoResize && "overflow-hidden resize-none",
        className,
      )}
      onChange={(event) => {
        onChange?.(event);

        if (autoResize) {
          resizeTextarea();
        }
      }}
      ref={(node) => {
        innerRef.current = node;

        if (typeof ref === "function") {
          ref(node);
          return;
        }

        if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
            node;
        }
      }}
      {...props}
    />
  );
}
Textarea.displayName = "Textarea";

export { Textarea };
