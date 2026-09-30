export interface LocationUnitCardModel {
  key: string;
  objectId: string | null;
  unitCount: number | null;
}

export function locationUnitCards(
  objectIds: readonly string[],
): LocationUnitCardModel[] {
  if (objectIds.length === 0) {
    return [{ key: "empty", objectId: null, unitCount: 0 }];
  }

  return objectIds.map((objectId) => ({
    key: objectId,
    objectId,
    unitCount: null,
  }));
}
