/**
 * Pure TypeScript RFC 4180 CSV cell escaping and formatting utility.
 */

export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return "";
  }

  const str = String(val);

  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function formatCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(",") + "\r\n";
}
