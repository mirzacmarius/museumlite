"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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
  const goKeyPressedRef = useRef(false);
  const onShowHelpRef = useRef(onShowHelp);
  const routerRef = useRef(router);

  useEffect(() => {
    onShowHelpRef.current = onShowHelp;
    routerRef.current = router;
  }, [onShowHelp, router]);

  const handleKeyDownRef = useRef((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    if (isInput) return;

    if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onShowHelpRef.current?.();
      return;
    }

    if (e.key === "o" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      routerRef.current.push("/objects/new");
      return;
    }

    if (e.key === "l" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      routerRef.current.push("/loans/new");
      return;
    }

    if (e.key === "g" || e.key === "G") {
      goKeyPressedRef.current = true;
      setTimeout(() => {
        goKeyPressedRef.current = false;
      }, 1000);
      return;
    }

    if (goKeyPressedRef.current) {
      goKeyPressedRef.current = false;
      switch (e.key.toLowerCase()) {
        case "d":
          e.preventDefault();
          routerRef.current.push("/");
          break;
        case "o":
          e.preventDefault();
          routerRef.current.push("/objects");
          break;
        case "l":
          e.preventDefault();
          routerRef.current.push("/loans");
          break;
      }
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDownRef.current(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  return { shortcuts: KEYBOARD_SHORTCUTS };
}
