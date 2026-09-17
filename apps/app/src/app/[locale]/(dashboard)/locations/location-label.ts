export function formatLocationLabel(locationCode: string, name: string) {
  return `${locationCode} · ${name}`;
}

export function formatLocationInfoWithId(
  locationInfo: string,
  locationCode: string,
) {
  return `${locationInfo} (${locationCode})`;
}

export function formatLocationSelectorLabel(location: {
  name: string;
  locationCode: string;
  path: Array<{ name: string }>;
}) {
  if (location.path.length <= 1) {
    return formatLocationInfoWithId(location.name, location.locationCode);
  }

  const pathString = location.path
    .slice(0, -1)
    .map((segment) => segment.name)
    .join(" → ");
  return formatLocationInfoWithId(
    `${pathString} → ${location.name}`,
    location.locationCode,
  );
}
