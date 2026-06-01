/** Config loaders — the workshop swap-seam, read as data. */
import type { CsvProfile, ExcelMap, StoreConfig, StoresRegistry } from "./types";
import { underRoot } from "./util/paths";
import { readJsonFile } from "./util/json";

export async function loadStores(root: string): Promise<StoresRegistry> {
  return (await readJsonFile(underRoot(root, "config", "stores.json"))) as StoresRegistry;
}

export async function getStore(root: string, id: string): Promise<StoreConfig> {
  const registry = await loadStores(root);
  const store = registry.stores.find((entry) => entry.id === id);
  if (!store) {
    throw new Error(`Unknown store "${id}" — known: ${registry.stores.map((s) => s.id).join(", ")}`);
  }
  return store;
}

export async function loadCsvProfile(root: string, stem: string): Promise<CsvProfile> {
  return (await readJsonFile(underRoot(root, "config", "csv-profiles", `${stem}.json`))) as CsvProfile;
}

export async function loadExcelMap(root: string, stem: string): Promise<ExcelMap> {
  return (await readJsonFile(underRoot(root, "config", "excel-maps", `${stem}.json`))) as ExcelMap;
}
