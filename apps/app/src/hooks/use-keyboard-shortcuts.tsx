"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export interface KeyboardShortcut {
  key: string;
  description: string;
  keys: string[];
  action?: () => void;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: "search",
    description: "Open search / command palette",
    keys: ["⌘", "K"],
  },
  {
    key: "new-object",
    description: "Create new object",
    keys: ["⌘", "⇧", "O"],
  },
  {
    key: "new-loan",
    description: "Create new loan",
    keys: ["⌘", "⇧", "L"],
  },
  {
    key: "help",
    description: "Show keyboard shortcuts",
    keys: ["?"],
  },
  {
    key: "dashboard",
    description: "Go to dashboard",
    keys: ["G", "D"],
  },
  {
    key: "objects",
    description: "Go to objects",
    keys: ["G", "O"],
  },
  {
    key: "loans",
    description: "Go to loans",
    keys: ["G", "L"],
  },
];

interface UseKeyboardShortcutsOptions {
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts({
  onShowHelp,
}: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter();
  const [goKeyPressed, setGoKeyPressed] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onShowHelp?.();
        return;
      }

      if (e.key === "o" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        router.push("/objects/new");
        return;
      }

      if (e.key === "l" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        router.push("/loans/new");
        return;
      }

      if (e.key === "g" || e.key === "G") {
        setGoKeyPressed(true);
        setTimeout(() => setGoKeyPressed(false), 1000);
        return;
      }

      if (goKeyPressed) {
        setGoKeyPressed(false);
        switch (e.key.toLowerCase()) {
          case "d":
            e.preventDefault();
            router.push("/");
            break;
          case "o":
            e.preventDefault();
            router.push("/objects");
            break;
          case "l":
            e.preventDefault();
            router.push("/loans");
            break;
        }
      }
    },
    [router, onShowHelp, goKeyPressed],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts: KEYBOARD_SHORTCUTS };
}
