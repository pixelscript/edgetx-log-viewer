import camelCase from 'camelcase';
import type { LogValue } from '../types/logTypes';

export const toCamelCase = (str: string) =>
  camelCase(str
    .replace(/\(.*?\)/g, ''))

export const parseCSV = (csv: string) => {
  const [headerLine, ...lines] = csv.trim().split('\n');
  const headers = headerLine.split(',').map(toCamelCase);

  const data = lines.map(line => {
    const values = line.split(',');
    const entry: Record<string, LogValue> = {};

    headers.forEach((key, idx) => {
      const val = values[idx].replace(/(^"|"$)/g, '');
      if (key === 'gps') {
        const [lat, lon] = val.split(' ');
        entry[key] = { lat: Number(lat), long: Number(lon) };
      } else {
        entry[key] = isNaN(Number(val)) ? val : Number(val);
      }
    });

    return entry;
  });

  return data;
};
