"use client";

import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { AlertCircle, CheckCircle, Save, X, Zap } from "lucide-react";
import type { RefObject } from "react";
import type { ValidationResult } from "./template-combobox-types";

interface TemplateComboboxFormatModifierProps {
  editValue: string;
  inputRef: RefObject<HTMLInputElement | null>;
  showQuickInsert: boolean;
  setShowQuickInsert: (show: boolean) => void;
  validation?: ValidationResult;
  onEditValueChange: (value: string) => void;
  onSave?: () => void;
  onInsertToken: (token: string) => void;
}

export function TemplateComboboxFormatModifier({
  editValue,
  inputRef,
  showQuickInsert,
  setShowQuickInsert,
  validation,
  onEditValueChange,
  onSave,
  onInsertToken,
}: TemplateComboboxFormatModifierProps) {
  return (
    <div className="border-t border-border bg-muted/30">
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">
            Format Modifier
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setShowQuickInsert(!showQuickInsert)}
            >
              <Zap className="size-3 mr-1" />
              <span className="text-xs">Quick Insert</span>
            </Button>
            {onSave && validation?.isValid && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={onSave}
              >
                <Save className="size-3 mr-1" />
                <span className="text-xs">Save</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            className="font-mono text-xs h-8"
            placeholder="{YYYY}-{####}"
          />
        </div>

        {editValue && validation && (
          <div className="flex items-center gap-2 text-xs">
            {validation.isValid ? (
              <>
                <CheckCircle className="size-3 text-green-600 shrink-0" />
                <span className="text-green-700">Valid format</span>
                {validation.preview && (
                  <code className="text-[10px] bg-background px-1.5 py-0.5 rounded border">
                    {validation.preview}
                  </code>
                )}
              </>
            ) : (
              <>
                <AlertCircle className="size-3 text-red-600 shrink-0" />
                <span className="text-red-700 text-[10px]">
                  {validation.error}
                </span>
              </>
            )}
          </div>
        )}

        {showQuickInsert && (
          <TemplateQuickInsertPanel
            onClose={() => setShowQuickInsert(false)}
            onInsertToken={onInsertToken}
          />
        )}
      </div>
    </div>
  );
}

function TemplateQuickInsertPanel({
  onClose,
  onInsertToken,
}: {
  onClose: () => void;
  onInsertToken: (token: string) => void;
}) {
  return (
    <div className="border rounded-md p-2 space-y-2 bg-background">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">
          QUICK INSERT TOKENS
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-5 p-0"
          onClick={onClose}
        >
          <X className="size-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <TokenGroup
          title="Date"
          tokens={["{YYYY}", "{YY}", "{MM}", "{DD}"]}
          onInsertToken={onInsertToken}
        />
        <TokenGroup
          title="Counter"
          tokens={["{#}", "{###}", "{####}", "{#####}"]}
          onInsertToken={onInsertToken}
        />
        <TokenGroup
          title="Org"
          tokens={["{ORG}", "{ORG:3}"]}
          onInsertToken={onInsertToken}
        />
        <TokenGroup
          title="Separators"
          tokens={["-", ".", "/", "_"]}
          onInsertToken={onInsertToken}
        />
      </div>
    </div>
  );
}

function TokenGroup({
  title,
  tokens,
  onInsertToken,
}: {
  title: string;
  tokens: string[];
  onInsertToken: (token: string) => void;
}) {
  return (
    <div>
      <div className="font-medium mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">
        {tokens.map((token) => (
          <Button
            key={token}
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => onInsertToken(token)}
          >
            {token}
          </Button>
        ))}
      </div>
    </div>
  );
}
