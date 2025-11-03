"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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

export interface ConditionOption {
  value: string
  label: string
  description: string
}

const STANDARD_CONDITIONS: ConditionOption[] = [
  {
    value: "Excellent",
    label: "Excellent",
    description: "New or mint condition. Either purchased new or has been well curated since it was made.",
  },
  {
    value: "Very Good",
    label: "Very Good",
    description: "Shows some minor signs of use or age. Wear is normal, no visible damage.",
  },
  {
    value: "Good",
    label: "Good",
    description: "Item is aged or faded and may show minor damage but remains structurally sound.",
  },
  {
    value: "Poor",
    label: "Poor",
    description: "Item exhibits severe damage or heavy use and would require extensive stabilization, restoration or conservation.",
  },
]

interface ConditionComboboxProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ConditionCombobox({
  value,
  onValueChange,
  placeholder = "Select condition...",
  disabled = false,
}: ConditionComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  // Find selected option
  const selectedOption = STANDARD_CONDITIONS.find(
    (option) => option.value.toLowerCase() === value?.toLowerCase()
  )

  const handleSelect = (selectedValue: string) => {
    const newValue = selectedValue === value ? "" : selectedValue
    onValueChange?.(newValue)
    setOpen(false)
    setInputValue("")
  }

  // Filter options based on search
  const filteredConditions = STANDARD_CONDITIONS.filter((condition) =>
    condition.label.toLowerCase().includes(inputValue.toLowerCase()) ||
    condition.description.toLowerCase().includes(inputValue.toLowerCase())
  )

  const hasResults = filteredConditions.length > 0

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

            {hasResults && (
              <CommandGroup heading="Standard Conditions">
                {filteredConditions.map((condition) => (
                  <CommandItem
                    key={condition.value}
                    value={condition.value}
                    onSelect={() => handleSelect(condition.value)}
                    className="px-3 py-3"
                  >
                    <div className="flex w-full items-start gap-3">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          value?.toLowerCase() === condition.value.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{condition.label}</div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {condition.description}
                        </p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
