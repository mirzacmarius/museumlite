export interface EditLocationDialogProps {
  locationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}
