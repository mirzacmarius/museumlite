export interface DonorComboboxProps {
  organizationId?: string;
  collectionId?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  includeUnknownOption?: boolean;
}

export interface NewDonorForm {
  name: string;
  notes: string;
  phone: string;
  email: string;
  address: string;
}

export interface DonorOption {
  value: string;
  label: string;
  email?: string;
  contactSummary?: string;
}

export const initialDonorForm: NewDonorForm = {
  name: "",
  notes: "",
  phone: "",
  email: "",
  address: "",
};

export const UNKNOWN_DONORS_VALUE = "Unknown donors";

export function formatDonorName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function validateDonorEmail(email: string): boolean {
  if (!email.trim()) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
