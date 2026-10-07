"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useI18n } from "@/locales/client";

export interface KeyboardShortcut {
  key: string;
  description: string;
  keys: string[];
  action?: () => void;
}

export function getKeyboardShortcuts(
  translate: (key: string) => string,
): KeyboardShortcut[] {
  return [
    {
      key: "search",
      description: translate("untranslatedComponents.keyboardShortcuts.search"),
      keys: ["⌘", "K"],
    },
    {
      key: "new-object",
      description: translate(
        "untranslatedComponents.keyboardShortcuts.newObject",
      ),
      keys: ["⌘", "⇧", "O"],
    },
    {
      key: "new-loan",
      description: translate(
        "untranslatedComponents.keyboardShortcuts.newLoan",
      ),
      keys: ["⌘", "⇧", "L"],
    },
    {
      key: "help",
      description: translate("untranslatedComponents.keyboardShortcuts.help"),
      keys: ["?"],
    },
    {
      key: "dashboard",
      description: translate(
        "untranslatedComponents.keyboardShortcuts.dashboard",
      ),
      keys: ["G", "D"],
    },
    {
      key: "objects",
      description: translate(
        "untranslatedComponents.keyboardShortcuts.objects",
      ),
      keys: ["G", "O"],
    },
    {
      key: "loans",
      description: translate("untranslatedComponents.keyboardShortcuts.loans"),
      keys: ["G", "L"],
    },
  ];
}

interface UseKeyboardShortcutsOptions {
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts({
  onShowHelp,
}: UseKeyboardShortcutsOptions = {}) {
  const translate = useI18n();
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

  return { shortcuts: getKeyboardShortcuts(translate) };
}
