"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Sparkles, Pencil, Trash2, Star, ThumbsUp, CheckCircle, AlertTriangle, Save, Plus, X } from "lucide-react"
import { cn } from "@v1/ui/utils"
import { Button } from "@v1/ui/button"
import { Input } from "@v1/ui/input"
import { Textarea } from "@v1/ui/textarea"
import { Label } from "@v1/ui/label"
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
import { api } from "@v1/backend/convex/_generated/api"
import type { Id } from "@v1/backend/convex/_generated/dataModel"
import { useQuery, useMutation } from "convex/react"

export interface ConditionOption {
  value: string
  label: string
  description: string
  id?: string  // For custom conditions (enables edit/delete)
  icon?: React.ReactNode  // Icon for the condition
}

const STANDARD_CONDITIONS: ConditionOption[] = [
  {
    value: "Excellent",
    label: "Excellent",
    description: "New or mint condition. Either purchased new or has been well curated since it was made.",
    icon: <Star className="h-3.5 w-3.5 text-yellow-500" />,
  },
  {
    value: "Very Good",
    label: "Very Good",
    description: "Shows some minor signs of use or age. Wear is normal, no visible damage.",
    icon: <ThumbsUp className="h-3.5 w-3.5 text-green-500" />,
  },
  {
    value: "Good",
    label: "Good",
    description: "Item is aged or faded and may show minor damage but remains structurally sound.",
    icon: <CheckCircle className="h-3.5 w-3.5 text-blue-500" />,
  },
  {
    value: "Poor",
    label: "Poor",
    description: "Item exhibits severe damage or heavy use and would require extensive stabilization, restoration or conservation.",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
  },
]

interface ConditionComboboxProps {
  organizationId?: string
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  // Optional handlers for custom condition management
  onEditCondition?: (id: string) => void
  onDeleteCondition?: (id: string) => void
}

export function ConditionCombobox({
  organizationId,
  value,
  onValueChange,
  placeholder = "Select condition...",
  disabled = false,
  onEditCondition,
  onDeleteCondition,
}: ConditionComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newConditionName, setNewConditionName] = React.useState("")
  const [newConditionDesc, setNewConditionDesc] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  // Fetch custom conditions for the organization
  const customConditions = useQuery(
    api.conditionOptions.list,
    organizationId ? { organizationId: organizationId as Id<"organizations"> } : "skip"
  )

  // Mutations
  const createCondition = useMutation(api.conditionOptions.create)
  const removeCondition = useMutation(api.conditionOptions.remove)

  // Convert custom conditions to options format
  const customConditionOptions = React.useMemo(() => {
    return (customConditions || []).map((condition) => ({
      value: condition.name,
      label: condition.name,
      description: condition.description,
      id: condition._id,
    }))
  }, [customConditions])

  // Combine all options
  const allOptions = [...STANDARD_CONDITIONS, ...customConditionOptions]

  // Find selected option
  const selectedOption = allOptions.find(
    (option) => option.value.toLowerCase() === value?.toLowerCase()
  )

  const handleSelect = (selectedValue: string) => {
    const newValue = selectedValue === value ? "" : selectedValue
    onValueChange?.(newValue)
    setOpen(false)
    setInputValue("")
  }

  // Filter options based on search
  const filteredSystemConditions = STANDARD_CONDITIONS.filter((condition) =>
    condition.label.toLowerCase().includes(inputValue.toLowerCase()) ||
    condition.description.toLowerCase().includes(inputValue.toLowerCase())
  )

  const filteredCustomConditions = customConditionOptions.filter((condition) =>
    condition.label.toLowerCase().includes(inputValue.toLowerCase()) ||
    condition.description.toLowerCase().includes(inputValue.toLowerCase())
  )

  const hasResults = filteredSystemConditions.length > 0 || filteredCustomConditions.length > 0

  // Handle creating new condition inline
  const handleCreateCondition = async () => {
    if (!organizationId) {
      setError("Organization not found")
      return
    }

    if (!newConditionName.trim()) {
      setError("Condition name is required")
      return
    }

    if (!newConditionDesc.trim()) {
      setError("Condition description is required")
      return
    }

    try {
      await createCondition({
        organizationId: organizationId as Id<"organizations">,
        name: newConditionName.trim(),
        description: newConditionDesc.trim(),
      })
      
      // Select the newly created condition
      onValueChange?.(newConditionName.trim())
      
      // Reset form
      setNewConditionName("")
      setNewConditionDesc("")
      setShowAddForm(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create condition")
    }
  }

  // Handle deleting condition
  const handleDeleteCondition = async (conditionId: string) => {
    if (onDeleteCondition) {
      onDeleteCondition(conditionId)
    } else {
      try {
        await removeCondition({ conditionId: conditionId as Id<"conditionOptions"> })
        // Clear selection if deleted condition was selected
        if (value === customConditionOptions.find(c => c.id === conditionId)?.value) {
          onValueChange?.("")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete condition")
      }
    }
  }

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
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search conditions or type custom value..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {inputValue ? (
                <div className="p-4 text-sm">
                  <p className="text-muted-foreground mb-3">
                    No matching standard conditions found.
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
                    Use custom condition: <span className="ml-2 font-medium">{inputValue}</span>
                  </Button>
                </div>
              ) : (
                <span className="p-4 text-sm">Type to search or enter custom condition</span>
              )}
            </CommandEmpty>

            {filteredSystemConditions.length > 0 && (
              <CommandGroup heading="Standard Conditions">
                {filteredSystemConditions.map((condition) => (
                  <CommandItem
                    key={condition.value}
                    value={condition.value}
                    onSelect={() => handleSelect(condition.value)}
                    className="px-2 py-1.5"
                  >
                    <div className="flex w-full items-start gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          value?.toLowerCase() === condition.value.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {condition.icon}
                            <span className="font-medium text-sm">{condition.label}</span>
                            <Sparkles className="h-3 w-3 text-blue-500 shrink-0" aria-label="System condition" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {condition.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredSystemConditions.length > 0 && filteredCustomConditions.length > 0 && (
              <CommandSeparator />
            )}

            {filteredCustomConditions.length > 0 && (
              <CommandGroup heading="Organization Conditions">
                {filteredCustomConditions.map((condition) => (
                  <CommandItem
                    key={condition.value}
                    value={condition.value}
                    onSelect={() => handleSelect(condition.value)}
                    className="px-2 py-1.5"
                  >
                    <div className="flex w-full items-start gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          value?.toLowerCase() === condition.value.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div 
                        className="flex-1 min-w-0 flex items-start justify-between gap-2"
                        onClick={(e) => {
                          // Allow clicking on the condition area to select it
                          if ((e.target as HTMLElement).closest('button')) {
                            e.stopPropagation()
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{condition.label}</div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {condition.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {onEditCondition && condition.id && (
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
                                onEditCondition(condition.id!)
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {onDeleteCondition && condition.id && (
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
                                handleDeleteCondition(condition.id!)
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

          {/* Add Condition Section */}
          {organizationId && (
            <div className="border-t border-border bg-muted/30">
              <div className="p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Custom Condition
                  </label>
                  {!showAddForm && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      <span className="text-xs">New</span>
                    </Button>
                  )}
                </div>

                {showAddForm && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="newConditionName" className="text-[10px]">Name *</Label>
                      <Input
                        id="newConditionName"
                        value={newConditionName}
                        onChange={(e) => setNewConditionName(e.target.value)}
                        placeholder="e.g., Fair"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newConditionDesc" className="text-[10px]">Description *</Label>
                      <Textarea
                        id="newConditionDesc"
                        value={newConditionDesc}
                        onChange={(e) => setNewConditionDesc(e.target.value)}
                        placeholder="Describe this condition..."
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>

                    {error && (
                      <div className="text-[10px] text-destructive">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCondition}
                        className="h-6 text-[10px] px-2"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => {
                          setShowAddForm(false)
                          setNewConditionName("")
                          setNewConditionDesc("")
                          setError(null)
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {!showAddForm && (
                  <p className="text-[10px] text-muted-foreground">
                    Add organization-specific conditions
                  </p>
                )}
              </div>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
