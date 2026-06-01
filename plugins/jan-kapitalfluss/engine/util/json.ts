import { readFile } from "node:fs/promises";

export async function readJsonFile(path: string): Promise<unknown> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Failed to read JSON file ${path}: ${errorMessage(error)}`);
  }
}

export function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${context} must be an object`);
}

export function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`${context}.${key} must be a string`);
}

export function requireNullableString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string | null {
  const value = record[key];
  if (typeof value === "string" || value === null) {
    return value;
  }
  throw new Error(`${context}.${key} must be a string or null`);
}

export function requireArray(value: unknown, context: string): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  throw new Error(`${context} must be an array`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
