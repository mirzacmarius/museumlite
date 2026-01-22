"use client";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { type ReactNode, useState } from "react";
import { KeyboardShortcutsDialog } from "./keyboard-shortcuts-dialog";

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const [showHelp, setShowHelp] = useState(false);

  useKeyboardShortcuts({
    onShowHelp: () => setShowHelp(true),
  });

  return (
    <>
      {children}
      <KeyboardShortcutsDialog open={showHelp} onOpenChange={setShowHelp} />
    </>
  );
}
