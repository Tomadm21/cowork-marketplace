import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import type { CsvProfile, NormalizedTxn, RawArtifact, TransactionSource } from "../types";
import { sha256Hex } from "../util/hash";

type CsvRow = { cells: string[]; startLine: number };

export class CommerzbankCsvSource implements TransactionSource {
  readonly id = "commerzbank-csv";

  constructor(
    private readonly profile: CsvProfile,
    private readonly csvPath: string,
  ) {}

  async fetch(): Promise<RawArtifact> {
    try {
      const bytes = await readFile(this.csvPath);
      const fetched = new Date();
      return {
        bytes: new Uint8Array(bytes),
        filename: basename(this.csvPath),
        sha256: sha256Hex(bytes),
        fetchedAtUtc: fetched.toISOString(),
        fetchedAtBerlin: formatBerlinIso(fetched),
      };
    } catch (error) {
      throw new Error(`Failed to fetch Commerzbank CSV ${this.csvPath}: ${errorMessage(error)}`);
    }
  }

  parse(raw: RawArtifact): NormalizedTxn[] {
    const decoded = decodeCsv(raw.bytes, this.profile.encoding);
    const rows = parseCsvRows(decoded, this.profile.delimiter);
    const headerRow = rows.find((row) => row.cells.some((cell) => cell.trim() !== ""));
    if (!headerRow) {
      throw new Error(`CSV ${raw.filename} contains no header row`);
    }
    const header = headerRow.cells.map((cell) => cell.replace(/^\uFEFF/, "").trim());
    const matched = this.profile.headerVariants.some((variant) => arraysEqual(variant, header));
    if (!matched) {
      throw new Error(`CSV ${raw.filename} header does not match configured variants: ${header.join("|")}`);
    }

    const txns: NormalizedTxn[] = [];
    for (const row of rows) {
      if (row.startLine <= headerRow.startLine) {
        continue;
      }
      if (row.cells.every((cell) => cell.trim() === "")) {
        continue;
      }
      const rawRecord = mapHeaderCells(header, row.cells);
      const normalized = normalizeRecord(rawRecord, this.profile, raw.filename, row.startLine);
      if (shouldFilter(normalized.fieldValues, this.profile)) {
        continue;
      }
      txns.push({
        bookingDate: normalized.bookingDate,
        valueDate: normalized.valueDate,
        amountCents: normalized.amountCents,
        currency: normalized.currency,
        type: normalized.type,
        counterparty: normalized.counterparty,
        purpose: normalized.purpose,
        raw: rawRecord,
        sourceLine: row.startLine,
      });
    }
    return txns;
  }
}

export function decodeCsv(bytes: Uint8Array, encoding: CsvProfile["encoding"]): string {
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  if (encoding === "auto") {
    const payload = hasBom ? bytes.slice(3) : bytes;
    const decoder = hasBom ? new TextDecoder("utf-8") : new TextDecoder("windows-1252");
    return decoder.decode(payload);
  }
  if (encoding === "utf-8-bom") {
    if (!hasBom) {
      throw new Error("CSV was configured as utf-8-bom but no BOM was present");
    }
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }
  if (encoding === "utf-8") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (encoding === "windows-1252") {
    return new TextDecoder("windows-1252").decode(bytes);
  }
  const exhaustive: never = encoding;
  throw new Error(`Unsupported CSV encoding ${exhaustive}`);
}

export function parseCsvRows(text: string, delimiter: string): CsvRow[] {
  if (delimiter.length !== 1) {
    throw new Error(`CSV delimiter must be one character, got "${delimiter}"`);
  }
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      cells.push(current);
      rows.push({ cells, startLine: rowStartLine });
      cells = [];
      current = "";
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      line += 1;
      rowStartLine = line;
      continue;
    }
    if (char === "\n" || char === "\r") {
      current += " ";
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      line += 1;
      continue;
    }
    current += char;
  }
  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field");
  }
  if (current.length > 0 || cells.length > 0) {
    cells.push(current);
    rows.push({ cells, startLine: rowStartLine });
  }
  return rows;
}

function normalizeRecord(
  raw: Record<string, string>,
  profile: CsvProfile,
  filename: string,
  sourceLine: number,
): {
  bookingDate: string;
  valueDate: string;
  amountCents: number;
  currency: string;
  type: string;
  purpose: string;
  counterparty: string;
  fieldValues: Record<string, string | number>;
} {
  const fields = mapConfiguredFields(raw, profile.columns);
  const bookingDate = parseGermanDate(requireField(fields, "bookingDate", filename, sourceLine));
  const valueDate = parseGermanDate(requireField(fields, "valueDate", filename, sourceLine));
  const amountCents = parseGermanCents(requireField(fields, "amount", filename, sourceLine));
  const currency = requireField(fields, "currency", filename, sourceLine).trim();
  const type = requireField(fields, "type", filename, sourceLine).trim();
  const purpose = collapseMemo(requireField(fields, "purpose", filename, sourceLine));
  if (currency !== "EUR") {
    throw new Error(`CSV ${filename} line ${sourceLine}: unsupported currency "${currency}"`);
  }
  return {
    bookingDate,
    valueDate,
    amountCents,
    currency,
    type,
    purpose,
    counterparty: deriveCounterparty(purpose),
    fieldValues: { ...fields, amount: amountCents },
  };
}

function mapHeaderCells(header: string[], cells: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let index = 0; index < header.length; index += 1) {
    const key = header[index];
    if (!key) {
      continue;
    }
    record[key] = cells[index] ?? "";
  }
  return record;
}

function mapConfiguredFields(
  raw: Record<string, string>,
  columns: Record<string, string>,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [header, field] of Object.entries(columns)) {
    if (Object.prototype.hasOwnProperty.call(raw, header)) {
      fields[field] = raw[header] ?? "";
    }
  }
  return fields;
}

function requireField(
  fields: Record<string, string>,
  name: string,
  filename: string,
  sourceLine: number,
): string {
  const value = fields[name];
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`CSV ${filename} line ${sourceLine}: missing required field ${name}`);
}

function shouldFilter(fieldValues: Record<string, string | number>, profile: CsvProfile): boolean {
  return profile.infoRowFilters.some((filter) => {
    const value = fieldValues[filter.field];
    if (filter.equals !== undefined && String(value) === filter.equals) {
      return true;
    }
    if (filter.amountZero === true && filter.field === "amount" && value === 0) {
      return true;
    }
    return false;
  });
}

function parseGermanDate(input: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid DD.MM.YYYY date "${input}"`);
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date "${input}"`);
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseGermanCents(input: string): number {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid German decimal amount "${input}"`);
  }
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [eurosPart, centsPart = ""] = unsigned.split(".");
  const cents = Number(eurosPart) * 100 + Number(centsPart.padEnd(2, "0"));
  if (!Number.isInteger(cents)) {
    throw new Error(`Invalid cent amount "${input}"`);
  }
  return negative ? -cents : cents;
}

function collapseMemo(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function deriveCounterparty(purpose: string): string {
  const split = purpose.split(/\s{2,}|,|\//)[0] ?? purpose;
  return split.trim().slice(0, 80);
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function formatBerlinIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? "00";
  const localUtcMs = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
  const offsetMinutes = Math.round((localUtcMs - date.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.trunc(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${sign}${hours}:${minutes}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
