export function formatLocationLabel(
  locationCode: string,
  name: string,
): string {
  return `${locationCode} · ${name}`;
}

export function formatLocationInfoWithId(
  locationInfo: string,
  locationCode: string,
): string {
  return `${locationInfo} (${locationCode})`;
}

interface LocationSelectorLabelInput {
  name: string;
  locationCode: string;
  path: Array<{ name: string }>;
}

export function formatLocationSelectorLabel(
  location: LocationSelectorLabelInput,
): string {
  const ancestorNames = location.path
    .slice(0, -1)
    .map((segment) => segment.name);
  const locationInfo = [...ancestorNames, location.name].join(" → ");
  return formatLocationInfoWithId(locationInfo, location.locationCode);
}
