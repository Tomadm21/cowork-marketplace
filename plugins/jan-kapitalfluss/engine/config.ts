/** Config loaders — the workshop swap-seam, read as data. */
import type { AccountConfig, CsvProfile, ExcelMap } from "./types";
import { underRoot } from "./util/paths";
import { readJsonFile } from "./util/json";

/** Load THE account config. There is exactly one — no store/account selector. */
export async function loadAccount(root: string): Promise<AccountConfig> {
  return (await readJsonFile(underRoot(root, "config", "account.json"))) as AccountConfig;
}

export async function loadCsvProfile(root: string, stem: string): Promise<CsvProfile> {
  return (await readJsonFile(underRoot(root, "config", "csv-profiles", `${stem}.json`))) as CsvProfile;
}

export async function loadExcelMap(root: string, stem: string): Promise<ExcelMap> {
  return (await readJsonFile(underRoot(root, "config", "excel-maps", `${stem}.json`))) as ExcelMap;
}
