export interface LibrarySettingsFormData {
  defaultLoanPeriodDays: number;
  defaultRenewalLimit: number;
  renewalPeriodDays: number;
  maxRenewalsAllowed: number;
  finePerDayDefault: number;
  maxFinePerItem: number;
  gracePeriodDays: number;
  fineThresholdForBlock: number;
  holdExpirationDays: number;
  maxHoldsPerPatron: number;
  cardNumberPrefix: string;
  cardNumberLength: number;
  autoGenerateCardNumbers: boolean;
  classificationSystem: "dewey" | "lc" | "custom";
  dueDateReminderDays: number;
}

export const defaultLibrarySettingsFormData: LibrarySettingsFormData = {
  defaultLoanPeriodDays: 14,
  defaultRenewalLimit: 2,
  renewalPeriodDays: 14,
  maxRenewalsAllowed: 2,
  finePerDayDefault: 0.25,
  maxFinePerItem: 10,
  gracePeriodDays: 1,
  fineThresholdForBlock: 25,
  holdExpirationDays: 7,
  maxHoldsPerPatron: 10,
  cardNumberPrefix: "LIB",
  cardNumberLength: 10,
  autoGenerateCardNumbers: true,
  classificationSystem: "dewey",
  dueDateReminderDays: 3,
};
