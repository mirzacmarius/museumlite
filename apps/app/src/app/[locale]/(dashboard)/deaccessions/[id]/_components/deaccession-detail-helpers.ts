export function getDeaccessionActionLabel(
  deaccession: {
    targetCollectionStatus: "deaccessioned" | "archived" | "deleted";
    method: "sale" | "donation" | "destruction" | "transfer";
  },
  t: (key: string) => string,
) {
  if (deaccession.targetCollectionStatus === "archived") {
    return t("untranslatedRecords.deaccessions.actions.archive");
  }

  if (deaccession.targetCollectionStatus === "deleted") {
    return t("untranslatedRecords.deaccessions.actions.delete");
  }

  switch (deaccession.method) {
    case "sale":
      return t("untranslatedRecords.deaccessions.actions.sale");
    case "donation":
      return t("untranslatedRecords.deaccessions.actions.donation");
    case "transfer":
      return t("untranslatedRecords.deaccessions.actions.transfer");
    case "destruction":
      return t("untranslatedRecords.deaccessions.actions.disposal");
  }
}

export function formatStatusLabel(value: string, t: (key: string) => string) {
  switch (value) {
    case "active":
      return t("objects.filters.active");
    case "loaned":
      return t("objects.filters.loaned");
    case "deaccessioned":
      return t("objects.filters.deaccessioned");
    case "archived":
      return t("objects.filters.archived");
    case "deleted":
      return t("objects.filters.deleted");
    default:
      return value;
  }
}
