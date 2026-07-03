import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// compute.ts is a CLI (argv in, JSON out) — tested end-to-end via subprocess,
// exactly the way the skill invokes it.

const SCRIPT = path.join(import.meta.dir, "compute.ts");
let tmp: string;

beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cc-compute-")); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function run(config: unknown, input: unknown): { code: number; out: any; err: string } {
  const cfgPath = path.join(tmp, `cfg-${Math.random().toString(36).slice(2)}.json`);
  const inPath = path.join(tmp, `in-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(cfgPath, JSON.stringify(config));
  fs.writeFileSync(inPath, JSON.stringify(input));
  const r = spawnSync("bun", [SCRIPT, cfgPath, inPath], { encoding: "utf8" });
  let out: any = null;
  try { out = JSON.parse(r.stdout); } catch { /* non-JSON on fail() */ }
  return { code: r.status ?? -1, out, err: r.stderr };
}

const CFG = {
  vat_rate: 0.19,
  tiers: { top: { montage: 40, fahrt: 33 }, std: { montage: 35, fahrt: 30 } },
  default_tier: "std",
  zuschlag_samstag: 0.25,
  zuschlag_sonntag: 0.5,
  weekend_days: [6, 0],
  people: { muster_a: { name: "Mitarbeiter A", tier: "top", vehicle: "Fahrzeug 1" } },
  vehicles: { "Fahrzeug 1": { label: "Fahrzeug 1" } },
  pflicht_pause_h: 0.5,
  daily_cap_total_h: 17,
  pause_pre_applied: true,
  spesen: { volltag_24h: 30, halbtag_8h: 15 },
  hotel_cost: 85,
  kfz_rate_per_km: 0.75,
};

const day = (d: string, extra: object = {}) =>
  ({ person: "muster_a", date: d, arbeit_h: 8, fahrt_h: 0.5, hotel: true, km: 0, ...extra });

const INPUT = {
  kw: 27, jahr: 2026, baustelle: "Musterstraße 5",
  rows: [
    { person: "muster_a", date: "2026-06-29", arbeit_h: 0, fahrt_h: 4, hotel: true, km: 300 }, // Anreise Mo
    day("2026-06-30"),
    day("2026-07-01"),
    { person: "muster_a", date: "2026-07-02", arbeit_h: 0, fahrt_h: 4, hotel: false, km: 300 }, // Heimfahrt
  ],
};

// ── Golden master: locks the core math the fuzz/hand verification confirmed ──

describe("preset math (golden master)", () => {
  test("totals, subtotals and reconciliation are exact", () => {
    const { code, out } = run(CFG, INPUT);
    expect(code).toBe(0);
    const p = out.people[0];
    // Montage: 16h × 40 = 640 · Fahrt: 9h × 33 = 297 (alles Werktage)
    expect(p.montage_betrag).toBe(640);
    expect(p.fahrt_betrag).toBe(297);
    // Spesen: Halbtag + 2×Volltag + Halbtag = 15+30+30+15 = 90 · Hotel: 3×85 = 255
    expect(p.spesen_betrag).toBe(90);
    expect(p.hotel_betrag).toBe(255);
    expect(p.zwischensumme).toBe(640 + 297 + 90 + 255);
    // Geräte: 600 km × 0.75 = 450
    expect(out.geraete_betrag).toBe(450);
    expect(out.summe_netto).toBe(p.zwischensumme + 450);
    expect(out.summe_brutto).toBe(Math.round((out.summe_netto * 1.19 + Number.EPSILON) * 100) / 100);
    // subtotals reconcile with the person's montage/fahrt amounts
    const s = p.subtotals;
    expect(s.montage_werktag_betrag + s.montage_samstag_betrag + s.montage_sonntag_betrag).toBe(p.montage_betrag);
    expect(s.fahrt_werktag_betrag + s.fahrt_samstag_betrag + s.fahrt_sonntag_betrag).toBe(p.fahrt_betrag);
  });

  test("weekend zuschlag hits montage AND fahrt rate", () => {
    const { out } = run(CFG, { ...INPUT, rows: [day("2026-07-04", { hotel: false })] }); // Samstag
    const d = out.people[0].days[0];
    expect(d.kind).toBe("samstag");
    expect(d.montage_rate).toBe(50);   // 40 × 1.25
    expect(d.fahrt_rate).toBe(41.25);  // 33 × 1.25
  });

  test("legacy pause mode (pause_pre_applied:false) still caps then splits proportionally", () => {
    const cfg = { ...CFG, pause_pre_applied: false };
    const { out } = run(cfg, {
      ...INPUT,
      rows: [{ person: "muster_a", date: "2026-06-29", arbeit_h: 12, fahrt_h: 6, pause_h: 1, hotel: false, km: 0 }],
    });
    const d = out.people[0].days[0];
    expect(d.arbeit_h + d.fahrt_h).toBe(16); // cap 17, minus pause 1
    expect(d.arbeit_h).toBe(10.67);
    expect(d.fahrt_h).toBe(5.33);
  });
});

// ── Validation: garbage must stop the run, never compute ─────────────────────

describe("validation (fail loud)", () => {
  test("legacy single-number tier → exit 1 with migration hint", () => {
    const cfg = { ...CFG, tiers: { std: 35 } as any, default_tier: "std" };
    const { code, err } = run(cfg, INPUT);
    expect(code).toBe(1);
    expect(err).toContain("montage, fahrt");
    expect(err).toContain("Onboarding");
  });

  test("legacy weekday/weekend tier → exit 1", () => {
    const cfg = { ...CFG, tiers: { std: { weekday: 35, weekend: 45 } } as any, default_tier: "std" };
    expect(run(cfg, INPUT).code).toBe(1);
  });

  test("string hours (vision extraction artifact) → exit 1, not string concatenation", () => {
    const rows = [{ person: "muster_a", date: "2026-06-29", arbeit_h: "8" as any, fahrt_h: 0.5 }];
    const { code, err } = run(CFG, { ...INPUT, rows });
    expect(code).toBe(1);
    expect(err).toContain("arbeit_h");
  });

  test("negative hours → exit 1", () => {
    const rows = [{ person: "muster_a", date: "2026-06-29", arbeit_h: -2, fahrt_h: 0 }];
    expect(run(CFG, { ...INPUT, rows }).code).toBe(1);
  });

  test("legacy row field reisezeit_h → exit 1 with pointer to fahrt_h", () => {
    const rows = [{ person: "muster_a", date: "2026-06-29", arbeit_h: 8, reisezeit_h: 1 } as any];
    const { code, err } = run(CFG, { ...INPUT, rows });
    expect(code).toBe(1);
    expect(err).toContain("fahrt_h");
  });

  test("weekend_days outside {0,6} → exit 1 (would mis-assign zuschläge)", () => {
    const cfg = { ...CFG, weekend_days: [5, 6] };
    const { code, err } = run(cfg, INPUT);
    expect(code).toBe(1);
    expect(err).toContain("weekend_days");
  });

  test("missing arbeit_h → exit 1 (must be explicit 0 on pure travel days)", () => {
    const rows = [{ person: "muster_a", date: "2026-06-29", fahrt_h: 4 } as any];
    expect(run(CFG, { ...INPUT, rows }).code).toBe(1);
  });
});

// ── Nothing silently dropped / silently doubled ──────────────────────────────

describe("visibility of edge cases", () => {
  test("duplicate person+date → computed but loudly warned", () => {
    const rows = [day("2026-06-30"), day("2026-06-30")];
    const { code, out } = run(CFG, { ...INPUT, rows });
    expect(code).toBe(0);
    expect(out.warnings.join(" ")).toContain("doppelt erfasst");
  });

  test("km without vehicle land in a visible '(kein Fahrzeug)' position, not dropped", () => {
    const cfg = { ...CFG, people: { muster_b: { name: "B", tier: "std" } } };
    const rows = [{ person: "muster_b", date: "2026-06-30", arbeit_h: 8, fahrt_h: 0.5, km: 80 }];
    const { out } = run(cfg, { ...INPUT, rows });
    const pseudo = out.vehicles.find((v: any) => v.vehicle === "(kein Fahrzeug)");
    expect(pseudo.km_total).toBe(80);
    expect(out.geraete_betrag).toBe(60); // 80 × 0.75 — counted, visible, warned
    expect(out.warnings.join(" ")).toContain("(kein Fahrzeug)");
  });

  test("hotel night with zero hours (Schlechtwetter) → hotel billed + explicit spesen warning", () => {
    const rows = [day("2026-06-30"), { person: "muster_a", date: "2026-07-01", arbeit_h: 0, fahrt_h: 0, hotel: true }, day("2026-07-02")];
    const { out } = run(CFG, { ...INPUT, rows });
    expect(out.people[0].hotel_naechte).toBe(3);
    expect(out.warnings.join(" ")).toContain("Hotelnacht ohne Arbeits-/Fahrtstunden");
  });

  test("mid-tour volltag day without hotel → warned (Pendel-Tag?)", () => {
    const rows = [day("2026-06-30"), day("2026-07-01", { hotel: false }), day("2026-07-02", { hotel: false })];
    const { out } = run(CFG, { ...INPUT, rows });
    expect(out.warnings.join(" ")).toContain("keine Hotelnacht");
  });

  test("single active day with hotel flag → continuation warning", () => {
    const rows = [day("2026-06-30")];
    const { out } = run(CFG, { ...INPUT, rows });
    expect(out.warnings.join(" ")).toContain("einziger aktiver Tag");
  });

  test("year mismatch between rows and input.jahr → warned", () => {
    const rows = [day("2025-06-30", { hotel: false })];
    const { out } = run(CFG, { ...INPUT, rows });
    expect(out.warnings.join(" ")).toContain("input.jahr");
  });
});
