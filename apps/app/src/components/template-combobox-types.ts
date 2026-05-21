export interface TemplateOption {
  value: string;
  label: string;
  description?: string;
  isValid?: boolean;
  id?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  preview?: string;
}

export interface TemplateComboboxProps {
  systemPresets: TemplateOption[];
  customTemplates: TemplateOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  validation?: ValidationResult;
  onSaveTemplate?: (template: string) => void | Promise<void>;
  onEditTemplate?: (id: string) => void;
  onDeleteTemplate?: (id: string) => void;
}
