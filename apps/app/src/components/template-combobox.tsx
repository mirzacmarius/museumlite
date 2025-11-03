"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Sparkles, Save, Zap, X, CheckCircle, AlertCircle, Pencil, Trash2 } from "lucide-react"
import { cn } from "@v1/ui/utils"
import { Button } from "@v1/ui/button"
import { Input } from "@v1/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@v1/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v1/ui/popover"
import { Badge } from "@v1/ui/badge"

export interface TemplateOption {
  value: string
  label: string
  description?: string
  isValid?: boolean // Indicates if template is pre-validated
  id?: string // Template ID for edit/delete operations
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  preview?: string
}

interface TemplateComboboxProps {
  systemPresets: TemplateOption[]
  customTemplates: TemplateOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  // Optional validation support
  validation?: ValidationResult
  // Optional save template handler
  onSaveTemplate?: (template: string) => void | Promise<void>
  // Optional edit/delete handlers for custom templates
  onEditTemplate?: (id: string) => void
  onDeleteTemplate?: (id: string) => void
}

export function TemplateCombobox({
  systemPresets,
  customTemplates,
  value,
  onValueChange,
  placeholder = "Select template...",
  disabled = false,
  validation,
  onSaveTemplate,
  onEditTemplate,
  onDeleteTemplate,
}: TemplateComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [showQuickInsert, setShowQuickInsert] = React.useState(false)
  const [editValue, setEditValue] = React.useState(value || "")
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Update edit value when prop value changes
  React.useEffect(() => {
    setEditValue(value || "")
  }, [value])

  // Find selected option
  const allOptions = [...systemPresets, ...customTemplates]
  const selectedOption = allOptions.find((option) => option.value === value)

  const handleSelect = (selectedValue: string) => {
    const newValue = selectedValue === value ? "" : selectedValue
    onValueChange?.(newValue)
    setEditValue(newValue)
    setInputValue("")
  }

  const handleApplyEdit = () => {
    if (editValue !== value) {
      onValueChange?.(editValue)
    }
  }

  const insertToken = (token: string) => {
    const input = inputRef.current
    if (!input) return

    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const newValue = editValue.substring(0, start) + token + editValue.substring(end)

    setEditValue(newValue)
    onValueChange?.(newValue)

    // Set cursor position after inserted token
    setTimeout(() => {
      input.focus()
      const newPosition = start + token.length
      input.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const handleSave = async () => {
    if (onSaveTemplate && editValue && validation?.isValid) {
      await onSaveTemplate(editValue)
    }
  }

  // Filter options based on search
  const filteredSystemPresets = systemPresets.filter((preset) =>
    preset.label.toLowerCase().includes(inputValue.toLowerCase()) ||
    preset.value.toLowerCase().includes(inputValue.toLowerCase())
  )

  const filteredCustomTemplates = customTemplates.filter((template) =>
    template.label.toLowerCase().includes(inputValue.toLowerCase()) ||
    template.value.toLowerCase().includes(inputValue.toLowerCase())
  )

  const hasResults = filteredSystemPresets.length > 0 || filteredCustomTemplates.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9"
          disabled={disabled}
        >
          <span className="truncate text-left flex-1 text-sm">
            {selectedOption?.label || value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search templates or type custom format (must include counter like {####})..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              {inputValue ? (
                <div className="p-4 text-sm">
                  <p className="text-muted-foreground mb-3">
                    No matching templates found.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => {
                      onValueChange?.(inputValue)
                      setOpen(false)
                      setInputValue("")
                    }}
                  >
                    Use custom format: <code className="ml-2 font-mono text-xs">{inputValue}</code>
                  </Button>
                </div>
              ) : (
                <span className="p-4 text-sm">Type to search or enter custom format</span>
              )}
            </CommandEmpty>

            {filteredSystemPresets.length > 0 && (
              <CommandGroup heading="System Templates (Pre-validated)">
                {filteredSystemPresets.map((preset) => (
                  <CommandItem
                    key={preset.value}
                    value={preset.value}
                    onSelect={() => handleSelect(preset.value)}
                    className="px-3 py-2"
                  >
                    <div className="flex w-full items-center gap-3">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === preset.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{preset.label}</span>
                            <Sparkles className="h-3 w-3 text-blue-500 shrink-0" aria-label="System template - guaranteed valid" />
                          </div>
                          {preset.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {preset.description}
                            </p>
                          )}
                        </div>
                        <Badge 
                          variant="secondary" 
                          className="font-mono text-[10px] shrink-0 px-2 py-0.5 h-5"
                        >
                          {preset.value}
                        </Badge>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredSystemPresets.length > 0 && filteredCustomTemplates.length > 0 && (
              <CommandSeparator />
            )}

            {filteredCustomTemplates.length > 0 && (
              <CommandGroup heading="My Custom Templates">
                {filteredCustomTemplates.map((template) => (
                  <CommandItem
                    key={template.value}
                    value={template.value}
                    onSelect={() => handleSelect(template.value)}
                    className="px-3 py-2"
                  >
                    <div className="flex w-full items-center gap-3">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value === template.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div 
                        className="flex-1 min-w-0 flex items-center justify-between gap-2"
                        onClick={(e) => {
                          // Allow clicking on the template area to select it
                          if ((e.target as HTMLElement).closest('button')) {
                            e.stopPropagation()
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{template.label}</span>
                          {template.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge 
                            variant="outline" 
                            className="font-mono text-[10px] px-2 py-0.5 h-5"
                          >
                            {template.value}
                          </Badge>
                          {onEditTemplate && template.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                onEditTemplate(template.id!)
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {onDeleteTemplate && template.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                onDeleteTemplate(template.id!)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {/* Format Modifier Section */}
          <div className="border-t border-border bg-muted/30">
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Format Modifier
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => setShowQuickInsert(!showQuickInsert)}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    <span className="text-xs">Quick Insert</span>
                  </Button>
                  {onSaveTemplate && validation?.isValid && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={handleSave}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      <span className="text-xs">Save</span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => {
                    setEditValue(e.target.value)
                    onValueChange?.(e.target.value)
                  }}
                  className="font-mono text-xs h-8"
                  placeholder="{YYYY}-{####}"
                />
              </div>

              {/* Validation Feedback */}
              {editValue && validation && (
                <div className="flex items-center gap-2 text-xs">
                  {validation.isValid ? (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                      <span className="text-green-700">Valid format</span>
                      {validation.preview && (
                        <code className="text-[10px] bg-background px-1.5 py-0.5 rounded border">
                          {validation.preview}
                        </code>
                      )}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />
                      <span className="text-red-700 text-[10px]">{validation.error}</span>
                    </>
                  )}
                </div>
              )}

              {/* Quick Insert Panel */}
              {showQuickInsert && (
                <div className="border rounded-md p-2 space-y-2 bg-background">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">QUICK INSERT TOKENS</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => setShowQuickInsert(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div className="font-medium mb-1">Date</div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{YYYY}")}>
                          {"{YYYY}"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{YY}")}>
                          {"{YY}"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{MM}")}>
                          {"{MM}"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{DD}")}>
                          {"{DD}"}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-1">Counter</div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{#}")}>
                          {"{#}"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{###}")}>
                          {"{###}"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{####}")}>
                          {"{####}"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{#####}")}>
                          {"{#####}"}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-1">Org</div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{ORG}")}>
                          {"{ORG}"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("{ORG:3}")}>
                          {"{ORG:3}"}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-1">Separators</div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("-")}>
                          -
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken(".")}>
                          .
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("/")}>
                          /
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => insertToken("_")}>
                          _
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
