"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import {
  getKeyboardShortcuts,
  type KeyboardShortcut,
} from "@/hooks/use-keyboard-shortcuts";
import { useI18n } from "@/locales/client";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const translate = useI18n();
  const shortcuts = getKeyboardShortcuts(translate);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate("untranslatedComponents.labels.keyboardShortcuts")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {translate(
              "untranslatedComponents.labels.reviewAvailableNavigationActionAndHelpKeyboardShortcuts",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {translate("untranslatedComponents.labels.navigation")}
            </h4>
            <div className="space-y-1">
              {shortcuts.flatMap((shortcut) =>
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
              {translate("untranslatedComponents.labels.actions")}
            </h4>
            <div className="space-y-1">
              {shortcuts.flatMap((shortcut) =>
                ["new-object", "new-loan"].includes(shortcut.key)
                  ? [<ShortcutRow key={shortcut.key} shortcut={shortcut} />]
                  : [],
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {translate("untranslatedComponents.labels.help")}
            </h4>
            <div className="space-y-1">
              {shortcuts.flatMap((shortcut) =>
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

function ShortcutRow({ shortcut }: { shortcut: KeyboardShortcut }) {
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
