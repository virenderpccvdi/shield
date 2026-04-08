function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Export data as a CSV file and trigger browser download.
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const escape = (v: string | number): string => {
    const s = String(v);
    // Wrap in quotes if the value contains a comma, quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Export data as a JSON file and trigger browser download.
 */
export function exportToJSON(filename: string, data: unknown): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

/**
 * Export data as a TSV file with an .xlsx extension so Excel opens it natively.
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const escape = (v: string | number): string => {
    // Tab-separated: replace tabs and newlines in cell values to avoid breaking the format
    return String(v).replace(/\t/g, ' ').replace(/\n/g, ' ');
  };

  const lines: string[] = [
    headers.map(escape).join('\t'),
    ...rows.map((row) => row.map(escape).join('\t')),
  ];

  const tsvContent = lines.join('\r\n');
  // Use UTF-16 LE BOM so Excel correctly interprets special characters
  const bom = '\uFEFF';
  const blob = new Blob([bom + tsvContent], {
    type: 'application/vnd.ms-excel;charset=utf-16le;',
  });
  const base = filename.replace(/\.(xlsx?|csv|tsv)$/i, '');
  triggerDownload(blob, `${base}.xlsx`);
}
