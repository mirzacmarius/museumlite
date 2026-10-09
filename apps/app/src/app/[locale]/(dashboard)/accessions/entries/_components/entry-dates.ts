/**
 * Day pickers return local midnight. Due dates and handoffs on a chosen day
 * count until that day ends, so the receipt day itself stays valid.
 */
export function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** The chosen day's end, but never later than now. */
export function handoffTime(date: Date, now: number) {
  return Math.min(endOfDay(date), now);
}
