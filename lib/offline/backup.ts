// Saves a plain-text copy of what is waiting on a phone, for a manager to enter by hand if the phone is lost.

/** Spreadsheet programs run text that starts with = + - @ as a formula, so such cells are defused. */
const cell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function downloadCsv(filename: string, rows: unknown[][]) {
  const body = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
