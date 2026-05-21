export interface AddChildLocationDialogProps {
  parentLocationId?: string;
  parentLocationName?: string;
  parentLocationType?: string;
  parentLocationAddress?: string;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
