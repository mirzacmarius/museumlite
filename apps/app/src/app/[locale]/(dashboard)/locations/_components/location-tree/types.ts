export interface LocationTreeProps {
  organizationId: string;
}

export interface LocationItem {
  _id: string;
  name: string;
  type: string;
  parentLocationId?: string;
  sortOrder: number;
  isActive: boolean;
  children?: string[];
  address?: string;
  notes?: string;
}

export interface SelectedLocationAction {
  id: string;
  name: string;
  parentId?: string;
  type?: string;
  address?: string;
}

export interface LocationTreeInnerProps extends LocationTreeProps {
  initialExpandedItems: string[];
  onExpandedItemsChange: (items: string[]) => void;
  onEdit: (location: SelectedLocationAction) => void;
  onAddChild: (location: SelectedLocationAction) => void;
  onMove: (location: SelectedLocationAction) => void;
  onDelete: (location: SelectedLocationAction) => void;
}
