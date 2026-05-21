export interface ExhibitionFormData {
  title: string;
  location: string;
  startDate: Date;
  endDate: Date | undefined;
  isCurrent: boolean;
  isLoan: boolean;
  loanVenue: string;
  notes: string;
  collectionId?: string;
}

export interface ExhibitionScheduleConflict {
  id: string;
  title: string;
  startDate: number;
  endDate?: number;
  status: string;
}
