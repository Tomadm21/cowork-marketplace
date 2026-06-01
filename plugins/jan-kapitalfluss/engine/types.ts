/**
 * Engine contract — the single source of truth every component compiles against.
 * PORTABLE: this file (and all of engine/) must NOT import anything Cowork/Anthropic-specific.
 * Money is always integer cents; sign encodes direction (negative = debit/Soll, positive = credit/Haben).
 */

export type Cents = number; // integer cents; negative = debit, positive = credit

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

/** Byte-for-byte source artifact (the raw Commerzbank export), with provenance for GoBD. */
export interface RawArtifact {
  bytes: Uint8Array;
  filename: string;
  sha256: string;
  fetchedAtUtc: string; // ISO-8601 Z
  fetchedAtBerlin: string; // ISO-8601 +01:00/+02:00
}

/** One bank movement, normalized and source-independent. */
export interface NormalizedTxn {
  bookingDate: string; // ISO yyyy-mm-dd (from Buchungstag)
  valueDate: string; // ISO yyyy-mm-dd (from Wertstellung)
  amountCents: Cents;
  currency: string; // "EUR"
  type: string; // Umsatzart
  counterparty: string; // best-effort extracted name
  purpose: string; // normalized/collapsed Buchungstext (single line)
  raw: Record<string, string>; // original CSV fields, for traceability
  sourceLine: number; // 1-based line index in the source file
}

/** Pluggable source. Adapter v1 = Commerzbank CSV; v2 = CAMT.053; v3 = FinTS. */
export interface TransactionSource {
  readonly id: string; // e.g. "commerzbank-csv"
  fetch(): Promise<RawArtifact>;
  parse(raw: RawArtifact): NormalizedTxn[];
}

export interface CsvProfile {
  delimiter: string; // ";"
  encoding: "auto" | "utf-8-bom" | "utf-8" | "windows-1252";
  dateFormat: string; // "DD.MM.YYYY"
  decimal: "de"; // German comma-decimal
  amountColumn: string; // "Betrag"
  signInAmount: boolean; // sign lives in the amount column
  columns: Record<string, string>; // CSV header -> normalized field name
  infoRowFilters: Array<{ field: string; equals?: string; amountZero?: boolean }>;
  headerVariants: string[][]; // accepted header rows (variant A, B, ...)
}

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

export interface DbaRule {
  id: string; // stable rule id (appears in the audit trail)
  bucket: string; // DBA bucket / target category
  matchAny?: Array<{ field: "counterparty" | "purpose" | "type"; regex: string }>;
  amountSign?: "debit" | "credit"; // optional additional guard
  priority?: number; // lower = evaluated first
}

export interface DbaMapping {
  version: string; // semver (e.g. "1.0.0"); fixture uses "0.1.0-fixture"
  gitHash: string | null;
  reviewBucket: string; // e.g. "NEEDS_REVIEW"
  rules: DbaRule[];
}

export interface CategorizedTxn extends NormalizedTxn {
  bucket: string;
  ruleId: string | null; // null => fell through to needs-review
  needsReview: boolean;
  rowKey: string; // stable key for per-row exclusion (hash of source line + content)
}

// ---------------------------------------------------------------------------
// Excel mapping (the workshop swap-seam, expressed as data)
// ---------------------------------------------------------------------------

export interface ExcelCellMap {
  cells: Record<string, string>; // logicalName -> A1 (e.g. "saldoMonat": "C3")
  appendTable?: {
    sheet?: string;
    anchorCol: string; // first column of the append row
    startRow: number; // first data row
    columns: string[]; // columns written per appended row, in order
  };
}

export interface BucketTarget {
  sheet?: string;
  cell?: string;
  mode: "append" | "set" | "review"; // review = never written, surfaced for Jan
}

export interface ExcelMap {
  workbook: "vektonce" | "liquiditaet";
  sheets: Record<string, ExcelCellMap>; // real sheet name -> map
  bucketTargets?: Record<string, BucketTarget>; // DBA bucket -> where it lands
}

// ---------------------------------------------------------------------------
// Store registry
// ---------------------------------------------------------------------------

export interface StoreConfig {
  id: string;
  name: string;
  csvProfile: string; // key under config/csv-profiles/
  vektonceWorkbook: string; // path (resolved relative to plugin root unless absolute)
  vektonceMap: string; // key under config/excel-maps/
  liquiditaetWorkbook: string;
  liquiditaetMap: string;
  dbaMapping: string; // key under config/dba-mapping/
}

export interface StoresRegistry {
  stores: StoreConfig[];
}

// ---------------------------------------------------------------------------
// Change-overview / planned writes
// ---------------------------------------------------------------------------

export interface PlannedWrite {
  store: string;
  workbook: "vektonce" | "liquiditaet";
  sheet: string;
  cell: string; // A1 for set; resolved append cell for append
  kind: "set" | "append";
  oldValue: number | string | null;
  newValue: number; // raw numeric — NEVER a German-formatted string
  bucket: string;
  sourceMemo: string; // memo excerpt shown to Jan
  ruleId: string | null;
  rowKey: string; // matches CategorizedTxn.rowKey for exclusion
  isNew: boolean; // appended (NEU) row
}

export interface ChangeSet {
  runId: string;
  changesetHash: string; // hash over the canonical writes — the approval is bound to this
  generatedAtUtc: string;
  writes: PlannedWrite[];
  reviewItems: CategorizedTxn[]; // needs-review, never silently written
  summary: {
    txnCount: number;
    changedCount: number;
    newRowCount: number;
    reviewCount: number;
  };
}

// ---------------------------------------------------------------------------
// Approval (the hard gate)
// ---------------------------------------------------------------------------

export interface ApprovalDecision {
  runId: string;
  changesetHash: string; // MUST match the ChangeSet, or commit is rejected
  approver: string;
  decision: "approved" | "rejected";
  approvedAtUtc: string;
  excludedRowKeys: string[]; // per-row "ignorieren"
}

// ---------------------------------------------------------------------------
// GoBD archive
// ---------------------------------------------------------------------------

export interface ArchiveRecord {
  runId: string;
  prevHash: string | null; // hash chain link
  recordHash: string; // hash of this record (excluding recordHash itself)
  source: { filename: string; sha256: string };
  rulesetVersion: string;
  rulesetGitHash: string | null;
  timestampsUtc: string;
  timestampsBerlin: string;
  diff: PlannedWrite[];
  approver: string | null;
  decision: "approved" | "rejected" | "pending";
  snapshotBeforeHash: string; // sha256 of pre-write workbook bytes
  snapshotAfterHash: string | null; // sha256 of post-write workbook bytes
  noAutoBooking: true;
  noAutoSend: true;
}

// ---------------------------------------------------------------------------
// Run context
// ---------------------------------------------------------------------------

export interface RunContext {
  pluginRoot: string; // where config/ + fixtures/ live
  workRoot?: string; // where out/ + archive/ are written; defaults to pluginRoot (tests use a temp dir)
  storeId: string;
  approver: string;
  now: { utc: string; berlin: string };
}
