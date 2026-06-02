#!/usr/bin/env bun
/**
 * Command Center — invoicing money math (deterministic).
 *
 * The invoicing SKILL.md is FORBIDDEN from doing this arithmetic inline.
 * All totals/tiers/spesen/VAT come from here so the error class the
 * Command Center's engine prevented cannot silently return.
 *
 * Pure: no external dependencies, no I/O beyond reading the two JSON paths
 * given on argv and printing one JSON result block to stdout.
 *
 *   bun compute.ts <config.json> <input.json>
 *   (npx tsx compute.ts <config.json> <input.json> also works)
 *
 * All firm-specific values (rates, spesen amounts, people) live in the
 * firm's config — nothing about any client is hardcoded here.
 */

interface Tier { weekday: number; weekend: number }
interface Config {
  vat_rate: number;
  tiers: Record<string, Tier>;
  default_tier: string;
  people: Record<string, { name: string; tier: string; kfz?: boolean }>;
  pflicht_pause_h: number;       // statutory minimum break per worked day
  daily_cap_total_h: number;     // cap on (arbeit + reisezeit) per day (e.g. 17)
  spesen: { volltag_24h: number; halbtag_8h: number };
  hotel_cost: number;
  kfz_rate_per_km: number;
  weekend_days: number[];        // JS getUTCDay(): 0=Sun..6=Sat, e.g. [6,0]
}
interface Row {
  person: string;                // match key
  date: string;                  // YYYY-MM-DD
  arbeit_h: number;
  reisezeit_h?: number;
  pause_h?: number;
  hotel?: boolean;
  km?: number;
}
interface RunInput { kw: number; jahr: number; baustelle: string; rows: Row[] }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function fail(msg: string): never {
  console.error(`compute.ts error: ${msg}`);
  process.exit(1);
}

function loadJson<T>(path: string, what: string): T {
  try {
    // Bun + Node both expose require for JSON; use fs for portability.
    const fs = require("node:fs");
    return JSON.parse(fs.readFileSync(path, "utf8")) as T;
  } catch (e) {
    fail(`could not read ${what} at ${path}: ${(e as Error).message}`);
  }
}

function isWeekend(dateStr: string, weekendDays: number[]): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) fail(`invalid date: ${dateStr}`);
  return weekendDays.includes(d.getUTCDay());
}

function isoWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;            // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3);         // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

function main() {
  const [configPath, inputPath] = process.argv.slice(2);
  if (!configPath || !inputPath) fail("usage: compute.ts <config.json> <input.json>");

  const config = loadJson<Config>(configPath, "config");
  const input = loadJson<RunInput>(inputPath, "input");
  const warnings: string[] = [];

  if (!Array.isArray(input.rows) || input.rows.length === 0) fail("input.rows is empty");

  // Group rows by person.
  const byPerson = new Map<string, Row[]>();
  for (const r of input.rows) {
    if (!byPerson.has(r.person)) byPerson.set(r.person, []);
    byPerson.get(r.person)!.push(r);
  }

  const people = [];
  let summeNetto = 0;
  let spesenApplied = false;

  for (const [personKey, rows] of byPerson) {
    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Resolve tier from config.people: exact key first, then case-insensitive contains.
    let pcfg = config.people[personKey];
    let matchKind: "exact" | "fuzzy" | "none" = pcfg ? "exact" : "none";
    if (!pcfg) {
      const hit = Object.entries(config.people).find(
        ([k]) => personKey.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(personKey.toLowerCase())
      );
      if (hit) { pcfg = hit[1]; matchKind = "fuzzy"; }
    }
    const tierName = pcfg?.tier ?? config.default_tier;
    const tier = config.tiers[tierName];
    if (matchKind === "none") warnings.push(`Unbekannte Person "${personKey}" → Tier "${config.default_tier}" angenommen — bitte prüfen.`);
    if (matchKind === "fuzzy") warnings.push(`Person "${personKey}" unscharf auf "${pcfg!.name}" (Tier ${tierName}) gematcht — Tier bitte prüfen.`);
    if (!tier) fail(`tier "${tierName}" not defined in config.tiers`);
    const displayName = pcfg?.name ?? personKey;

    // Per-day netto hours + amount; collect active days for spesen.
    const days = [];
    const activeDays: { date: string; hotel: boolean }[] = [];
    let stundenSumme = 0;
    let stundenBetrag = 0;
    let kmTotal = 0;
    let hotelNights = 0;

    for (const r of rows) {
      const arbeit = r.arbeit_h ?? 0;
      const reise = r.reisezeit_h ?? 0;
      const pflicht = Math.max(config.pflicht_pause_h, r.pause_h ?? 0);
      let brutto = arbeit + reise;
      let capped = false;
      if (brutto > config.daily_cap_total_h) {
        brutto = config.daily_cap_total_h;
        capped = true;
        warnings.push(`${displayName} ${r.date}: Tag auf ${config.daily_cap_total_h}h gekappt — bitte prüfen.`);
      }
      const netto = round2(Math.max(0, brutto - pflicht));
      const rate = isWeekend(r.date, config.weekend_days) ? tier.weekend : tier.weekday;
      const betrag = round2(netto * rate);

      stundenSumme = round2(stundenSumme + netto);
      stundenBetrag = round2(stundenBetrag + betrag);
      kmTotal += r.km ?? 0;
      if (r.hotel) hotelNights += 1;
      if (arbeit > 0 || reise > 0) activeDays.push({ date: r.date, hotel: !!r.hotel });

      days.push({ date: r.date, brutto, pflicht_pause_h: round2(pflicht), netto_h: netto, rate, betrag, capped });
    }

    // Spesen: anreise (first active) + abreise (last active) = Halbtag (8h);
    // days in between = Volltag (24h). Single active day = Halbtag. Reviewable heuristic.
    const spesenDays = [];
    let spesenBetrag = 0;
    const n = activeDays.length;
    activeDays.forEach((d, i) => {
      let kind: "volltag" | "halbtag";
      if (n === 1) kind = "halbtag";
      else if (i === 0 || i === n - 1) kind = "halbtag";
      else kind = "volltag";
      const amount = kind === "volltag" ? config.spesen.volltag_24h : config.spesen.halbtag_8h;
      spesenBetrag = round2(spesenBetrag + amount);
      spesenDays.push({ date: d.date, kind, amount });
    });
    if (n > 0) spesenApplied = true;

    const kmBetrag = round2((pcfg?.kfz ? kmTotal : 0) * config.kfz_rate_per_km);
    if (kmTotal > 0 && !pcfg?.kfz) warnings.push(`${displayName}: ${kmTotal} km erfasst, aber kein KFZ in config → nicht berechnet. Prüfen.`);
    const hotelBetrag = round2(hotelNights * config.hotel_cost);
    const zwischensumme = round2(stundenBetrag + spesenBetrag + kmBetrag + hotelBetrag);
    summeNetto = round2(summeNetto + zwischensumme);

    people.push({
      person: personKey, name: displayName, tier: tierName,
      days, spesen_days: spesenDays,
      stunden_summe: stundenSumme, stunden_betrag: stundenBetrag,
      spesen_betrag: spesenBetrag, km_betrag: kmBetrag, km_total: kmTotal,
      hotel_naechte: hotelNights, hotel_betrag: hotelBetrag,
      zwischensumme,
    });
  }

  if (spesenApplied) warnings.push(`Spesen-Heuristik (An-/Abreise = Halbtag, dazwischen Volltag) auf alle Personen angewandt — bitte prüfen.`);

  // KW sanity: flag any row date whose ISO week differs from the stated KW (catches vision misreads).
  const wrongWeek = [...new Set(input.rows.map((r) => r.date).filter((d) => isoWeek(d) !== input.kw))];
  if (wrongWeek.length) warnings.push(`Datum außerhalb KW ${input.kw}: ${wrongWeek.join(", ")} — bitte prüfen (Lesefehler?).`);

  const mwstBetrag = round2(summeNetto * config.vat_rate);
  const summeBrutto = round2(summeNetto + mwstBetrag);

  const result = {
    kw: input.kw, jahr: input.jahr, baustelle: input.baustelle,
    waehrung: "EUR",
    people,
    summe_netto: summeNetto,
    mwst_satz: config.vat_rate,
    mwst_betrag: mwstBetrag,
    summe_brutto: summeBrutto,
    warnings,
    computed_by: "command-center/invoicing/compute.ts",
  };

  console.log(JSON.stringify(result, null, 2));
}

main();
