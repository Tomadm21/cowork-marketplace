import { test, expect, describe } from "bun:test";
import { CommerzbankCsvSource, decodeCsv, parseCsvRows } from "../engine/ingest/CommerzbankCsvSource";
import { loadCsvProfile } from "../engine/config";
import { repoRoot } from "./helpers";
import type { CsvProfile, RawArtifact } from "../engine/types";

function artifact(text: string, withBom = true): RawArtifact {
  const body = new TextEncoder().encode(text);
  const bytes = withBom ? new Uint8Array([0xef, 0xbb, 0xbf, ...body]) : body;
  return { bytes, filename: "test.csv", sha256: "x", fetchedAtUtc: "", fetchedAtBerlin: "" };
}

const HEADER_B =
  "Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung;IBAN Kontoinhaber;Kategorie";
const HEADER_A =
  "Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung;Auftraggeberkonto;Bankleitzahl Auftraggeberkonto;IBAN Auftraggeberkonto";

async function profile(): Promise<CsvProfile> {
  return loadCsvProfile(repoRoot(), "commerzbank-default");
}

describe("CommerzbankCsvSource.parse", () => {
  test("German decimal -> integer cents, sign from Betrag, DD.MM.YYYY -> ISO", async () => {
    const src = new CommerzbankCsvSource(await profile(), "ignored.csv");
    const csv = [
      HEADER_B,
      "28.05.2026;28.05.2026;Lastschrift;HAVI Warenlieferung;-12.480,55;EUR;DE1;",
      "30.05.2026;31.05.2026;Gutschrift;McDonalds Sammelgutschrift;8.945,12;EUR;DE1;Umsatz",
    ].join("\r\n");
    const txns = src.parse(artifact(csv));
    expect(txns.length).toBe(2);
    expect(txns[0]!.amountCents).toBe(-1248055);
    expect(txns[1]!.amountCents).toBe(894512);
    expect(txns[0]!.bookingDate).toBe("2026-05-28");
    expect(txns[1]!.valueDate).toBe("2026-05-31");
  });

  test("filters zero-amount info/ToS rows", async () => {
    const src = new CommerzbankCsvSource(await profile(), "ignored.csv");
    const csv = [
      HEADER_B,
      "01.05.2026;01.05.2026;Hinweis;AGB geaendert;0,00;EUR;DE1;",
      "02.05.2026;02.05.2026;Lastschrift;Echte Buchung;-10,00;EUR;DE1;",
    ].join("\r\n");
    const txns = src.parse(artifact(csv));
    expect(txns.length).toBe(1);
    expect(txns[0]!.purpose).toBe("Echte Buchung");
  });

  test("accepts header variant A too", async () => {
    const src = new CommerzbankCsvSource(await profile(), "ignored.csv");
    const csv = [HEADER_A, "03.05.2026;03.05.2026;Lastschrift;Test A;-1,00;EUR;DE9;0;DE9"].join("\r\n");
    const txns = src.parse(artifact(csv));
    expect(txns.length).toBe(1);
    expect(txns[0]!.amountCents).toBe(-100);
  });

  test("collapses a quoted multi-line Buchungstext to one memo", async () => {
    const src = new CommerzbankCsvSource(await profile(), "ignored.csv");
    const csv = [HEADER_B, '20.05.2026;20.05.2026;Lastschrift;"HAVI GmbH\nWarenlieferung KW20";-5,00;EUR;DE1;'].join("\r\n");
    const txns = src.parse(artifact(csv));
    expect(txns[0]!.purpose).toBe("HAVI GmbH Warenlieferung KW20");
  });

  test("rejects a header that matches no configured variant", async () => {
    const src = new CommerzbankCsvSource(await profile(), "ignored.csv");
    const csv = ["Foo;Bar;Baz", "a;b;c"].join("\r\n");
    expect(() => src.parse(artifact(csv))).toThrow();
  });
});

describe("decode + parse helpers", () => {
  test("auto strips BOM and decodes UTF-8", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Möhre")]);
    expect(decodeCsv(bytes, "auto")).toBe("Möhre");
  });

  test("auto falls back to windows-1252 when no BOM (0xE4 -> ä)", () => {
    expect(decodeCsv(new Uint8Array([0x42, 0xe4]), "auto")).toBe("Bä");
  });

  test("semicolon split honors quoted fields containing the delimiter", () => {
    const rows = parseCsvRows('a;"b;c";d', ";");
    expect(rows[0]!.cells).toEqual(["a", "b;c", "d"]);
  });
});
