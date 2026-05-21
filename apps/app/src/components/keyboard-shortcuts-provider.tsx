"use client";

import { type ReactNode, useState } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
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
