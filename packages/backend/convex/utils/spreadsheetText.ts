/**
 * Text cells shared by every CSV the product writes, server or browser.
 * A spreadsheet runs a cell that starts with =, +, - or @ as a formula, so
 * such text gets a leading apostrophe; parsers strip exactly one.
 */
export function protectSpreadsheetText(raw: string) {
  let candidate = raw.trimStart();
  while (candidate.length && candidate.charCodeAt(0) < 32)
    candidate = candidate.slice(1).trimStart();
  return /^[=+@-]/.test(candidate) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
}

/** `text` as an RFC 4180 quoted cell, quotes doubled. */
export function quotedCsvText(text: string) {
  return `"${text.replace(/"/g, '""')}"`;
}

/** A quoted CSV text cell with formulas disarmed. */
export function csvTextCell(value: string) {
  return quotedCsvText(protectSpreadsheetText(value));
}
