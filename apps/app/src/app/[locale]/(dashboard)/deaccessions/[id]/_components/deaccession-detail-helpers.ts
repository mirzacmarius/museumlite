export function getDeaccessionActionLabel(deaccession: {
  targetCollectionStatus: "deaccessioned" | "archived" | "deleted";
  method: "sale" | "donation" | "destruction" | "transfer";
}) {
  if (deaccession.targetCollectionStatus === "archived") {
    return "Archive";
  }

  if (deaccession.targetCollectionStatus === "deleted") {
    return "Delete";
  }

  switch (deaccession.method) {
    case "sale":
      return "Sale";
    case "donation":
      return "Donation";
    case "transfer":
      return "Transfer";
    case "destruction":
      return "Disposal";
  }
}

export function formatStatusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
