"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Trash2, Save, Plus, X } from "lucide-react"
import { cn } from "@v1/ui/utils"
import { Button } from "@v1/ui/button"
import { Input } from "@v1/ui/input"
import { Label } from "@v1/ui/label"
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
import { api } from "@v1/backend/convex/_generated/api"
import type { Id } from "@v1/backend/convex/_generated/dataModel"
import { useQuery, useMutation } from "convex/react"

interface MaterialsComboboxProps {
  organizationId?: string
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function MaterialsCombobox({
  organizationId,
  value,
  onValueChange,
  placeholder = "Select or add material...",
  disabled = false,
}: MaterialsComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newMaterialName, setNewMaterialName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  // Fetch materials for the organization
  const materials = useQuery(
    api.materialOptions.list,
    organizationId ? { organizationId: organizationId as Id<"organizations"> } : "skip"
  )

  // Mutations
  const createMaterial = useMutation(api.materialOptions.create)
  const removeMaterial = useMutation(api.materialOptions.remove)

  // Convert materials to options format
  const materialOptions = React.useMemo(() => {
    return (materials || []).map((material) => ({
      value: material.name,
      label: material.name,
      id: material._id,
    }))
  }, [materials])

  const handleSelect = (selectedValue: string) => {
    const newValue = selectedValue === value ? "" : selectedValue
    onValueChange?.(newValue)
    setOpen(false)
    setInputValue("")
  }

  // Filter options based on search
  const filteredMaterials = materialOptions.filter((material) =>
    material.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  // Handle creating new material inline
  const handleCreateMaterial = async () => {
    if (!organizationId) {
      setError("Organization not found")
      return
    }

    if (!newMaterialName.trim()) {
      setError("Material name is required")
      return
    }

    try {
      await createMaterial({
        organizationId: organizationId as Id<"organizations">,
        name: newMaterialName.trim(),
      })
      
      // Select the newly created material
      onValueChange?.(newMaterialName.trim())
      
      // Reset form
      setNewMaterialName("")
      setShowAddForm(false)
      setError(null)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create material")
    }
  }

  // Handle deleting material
  const handleDeleteMaterial = async (materialId: string) => {
    try {
      await removeMaterial({ materialId: materialId as Id<"materialOptions"> })
      // Clear selection if deleted material was selected
      if (value === materialOptions.find(m => m.id === materialId)?.value) {
        onValueChange?.("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete material")
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
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search materials or type new..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {inputValue ? (
                <div className="p-4 text-sm">
                  <p className="text-muted-foreground mb-3">
                    No matching materials found.
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
                    Use: <span className="ml-2 font-medium">{inputValue}</span>
                  </Button>
                </div>
              ) : (
                <span className="p-4 text-sm">Type to search or add material</span>
              )}
            </CommandEmpty>

            {filteredMaterials.length > 0 && (
              <CommandGroup heading="Organization Materials">
                {filteredMaterials.map((material) => (
                  <CommandItem
                    key={material.value}
                    value={material.value}
                    onSelect={() => handleSelect(material.value)}
                    className="px-2 py-1.5"
                  >
                    <div className="flex w-full items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value?.toLowerCase() === material.value.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="flex-1 text-sm">{material.label}</span>
                      {material.id && (
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
                            handleDeleteMaterial(material.id!)
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

          {/* Add Material Section */}
          {organizationId && (
            <div className="border-t border-border bg-muted/30">
              <div className="p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Add Material
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
                      <Label htmlFor="newMaterialName" className="text-[10px]">Material Name *</Label>
                      <Input
                        id="newMaterialName"
                        value={newMaterialName}
                        onChange={(e) => setNewMaterialName(e.target.value)}
                        placeholder="e.g., Oil on canvas"
                        className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleCreateMaterial()
                          }
                        }}
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
                        onClick={handleCreateMaterial}
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
                          setNewMaterialName("")
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
                    Add organization materials
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
