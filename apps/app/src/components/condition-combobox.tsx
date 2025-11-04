"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Trash2, Gem, Sparkles, ShieldCheck, AlertOctagon, Edit3 } from "lucide-react"
import { cn } from "@v1/ui/utils"
import { Button } from "@v1/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v1/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog"
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
    icon: <Gem className="h-3.5 w-3.5 text-emerald-500" />,
  },
  {
    value: "Very Good",
    label: "Very Good",
    description: "Shows some minor signs of use or age. Wear is normal, no visible damage.",
    icon: <Sparkles className="h-3.5 w-3.5 text-cyan-500" />,
  },
  {
    value: "Good",
    label: "Good",
    description: "Item is aged or faded and may show minor damage but remains structurally sound.",
    icon: <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />,
  },
  {
    value: "Poor",
    label: "Poor",
    description: "Item exhibits severe damage or heavy use and would require extensive stabilization, restoration or conservation.",
    icon: <AlertOctagon className="h-3.5 w-3.5 text-red-500" />,
  },
]

interface ConditionComboboxProps {
  organizationId?: string
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ConditionCombobox({
  organizationId,
  value,
  onValueChange,
  placeholder = "Select condition...",
  disabled = false,
}: ConditionComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [conditionToDelete, setConditionToDelete] = React.useState<{ id: string; name: string } | null>(null)

  // Fetch custom conditions for the organization
  const customConditions = useQuery(
    api.conditionOptions.list,
    organizationId ? { organizationId: organizationId as Id<"organizations"> } : "skip"
  )

  // Check condition usage when attempting to delete
  const conditionUsage = useQuery(
    api.conditionOptions.checkUsage,
    conditionToDelete ? { conditionId: conditionToDelete.id as Id<"conditionOptions"> } : "skip"
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

  // Format condition name with first letter uppercase
  const formatConditionName = (name: string): string => {
    const trimmed = name.trim()
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }

  // Handle creating and selecting condition inline
  const handleCreateAndSelectCondition = async (conditionName: string) => {
    if (!organizationId || !conditionName.trim()) {
      return
    }

    const formattedName = formatConditionName(conditionName)

    try {
      await createCondition({
        organizationId: organizationId as Id<"organizations">,
        name: formattedName,
        description: `Custom condition: ${formattedName}`,
      })
      
      // Select the newly created condition
      onValueChange?.(formattedName)
      
      // Clear input and close
      setInputValue("")
      setOpen(false)
    } catch (err) {
      // If condition already exists, just select it
      if (err instanceof Error && err.message.includes("already exists")) {
        onValueChange?.(formattedName)
        setInputValue("")
        setOpen(false)
      }
    }
  }

  // Handle deleting condition from organization
  const handleDeleteCondition = (conditionId: string, conditionName: string) => {
    setConditionToDelete({ id: conditionId, name: conditionName })
  }

  const confirmDeleteCondition = async () => {
    if (!conditionToDelete) return

    try {
      await removeCondition({ conditionId: conditionToDelete.id as Id<"conditionOptions"> })
      // Clear selection if it was selected
      if (value === conditionToDelete.name) {
        onValueChange?.("")
      }
      setConditionToDelete(null)
    } catch (err) {
      // Silently fail
      setConditionToDelete(null)
    }
  }

  return (
    <>
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
            placeholder="Search conditions or type new..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputValue.trim() && !hasResults) {
                e.preventDefault()
                handleCreateAndSelectCondition(inputValue)
              }
            }}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {inputValue ? (
                <div className="p-4 text-sm text-center">
                  <div className="text-muted-foreground mb-2">
                    No matching conditions found.
                  </div>
                  {organizationId && (
                    <div className="text-xs text-muted-foreground">
                      Press <kbd className="px-1.5 py-0.5 text-xs font-semibold border rounded bg-muted">Enter</kbd> to add <span className="font-medium text-foreground">"{formatConditionName(inputValue)}"</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Type to search conditions
                </div>
              )}
            </CommandEmpty>

            {(filteredSystemConditions.length > 0 || filteredCustomConditions.length > 0) && (
              <CommandGroup>
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {condition.icon}
                          <span className="font-medium text-sm">{condition.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {condition.description}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Edit3 className="h-3.5 w-3.5 text-purple-500" />
                          <span className="font-medium text-sm">{condition.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {condition.description}
                        </div>
                      </div>
                      {condition.id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            handleDeleteCondition(condition.id!, condition.label)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!conditionToDelete} onOpenChange={(open) => !open && setConditionToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {conditionUsage?.isUsed ? "Cannot Delete Condition" : "Delete Condition"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {conditionUsage?.isUsed ? (
              <div className="space-y-2">
                <div>
                  The condition <span className="font-semibold text-foreground">"{conditionToDelete?.name}"</span> cannot be deleted because it is currently being used by {conditionUsage.usageCount} {conditionUsage.usageCount === 1 ? "collection" : "collections"}.
                </div>
                {conditionUsage.collectionNames.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">Used in:</div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {conditionUsage.collectionNames.slice(0, 5).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                      {conditionUsage.collectionNames.length > 5 && (
                        <li className="italic">...and {conditionUsage.collectionNames.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div>
                Are you sure you want to delete <span className="font-semibold text-foreground">"{conditionToDelete?.name}"</span>? This action cannot be undone.
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {conditionUsage?.isUsed ? (
            <AlertDialogCancel>Close</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteCondition}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
