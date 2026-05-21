"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { KEYBOARD_SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Review available navigation, action, and help keyboard shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Navigation
            </h4>
            <div className="space-y-1">
              {KEYBOARD_SHORTCUTS.flatMap((shortcut) =>
                ["dashboard", "objects", "loans", "search"].includes(
                  shortcut.key,
                )
                  ? [<ShortcutRow key={shortcut.key} shortcut={shortcut} />]
                  : [],
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Actions
            </h4>
            <div className="space-y-1">
              {KEYBOARD_SHORTCUTS.flatMap((shortcut) =>
                ["new-object", "new-loan"].includes(shortcut.key)
                  ? [<ShortcutRow key={shortcut.key} shortcut={shortcut} />]
                  : [],
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Help
            </h4>
            <div className="space-y-1">
              {KEYBOARD_SHORTCUTS.flatMap((shortcut) =>
                shortcut.key === "help"
                  ? [<ShortcutRow key={shortcut.key} shortcut={shortcut} />]
                  : [],
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({
  shortcut,
}: {
  shortcut: (typeof KEYBOARD_SHORTCUTS)[number];
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-foreground/80">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, _i) => (
          <kbd
            key={`${shortcut.description}-${key}`}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
