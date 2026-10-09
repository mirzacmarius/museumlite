type Translator = (key: string) => string;

const collectionStatusKeys: Record<string, string> = {
  active: "objects.filters.active",
  verified: "settings.fineArt.verified",
  loaned: "objects.filters.loaned",
  deaccessioned: "objects.filters.deaccessioned",
  archived: "objects.filters.archived",
  deleted: "objects.filters.deleted",
};

const loanTypeKeys: Record<string, string> = {
  incoming: "loans.filters.incoming",
  outgoing: "loans.filters.outgoing",
};

const loanStatusKeys: Record<string, string> = {
  pending: "loans.status.pendingReview",
  active: "loans.status.active",
  dispatched: "loans.status.dispatched",
  returned: "loans.status.returned",
  cancelled: "loans.status.cancelled",
  draft: "loans.status.draft",
};

const accessionStatusKeys: Record<string, string> = {
  pending: "accessions.status.pending",
  approved: "accessions.status.approved",
  rejected: "accessions.status.rejected",
  withdrawn: "accessionReview.status.withdrawn",
  draft: "untranslatedRecords.objects.status.draft",
};

function translateKnownEnum(
  value: string,
  translations: Record<string, string>,
  tRoot: Translator,
): string {
  const key = Object.hasOwn(translations, value)
    ? translations[value]
    : undefined;
  return key ? tRoot(key) : value;
}

export function getCollectionStatusLabel(
  status: string,
  tRoot: Translator,
): string {
  return translateKnownEnum(status, collectionStatusKeys, tRoot);
}

export function getLoanTypeLabel(type: string, tRoot: Translator): string {
  return translateKnownEnum(type, loanTypeKeys, tRoot);
}

export function getLoanStatusLabel(status: string, tRoot: Translator): string {
  return translateKnownEnum(status, loanStatusKeys, tRoot);
}

export function getAccessionStatusLabel(
  status: string,
  tRoot: Translator,
): string {
  return translateKnownEnum(status, accessionStatusKeys, tRoot);
}
