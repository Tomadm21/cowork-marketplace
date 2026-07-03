#!/usr/bin/env bun
/**
 * Command Center — invoicing money math (deterministic).
 *
 * The invoicing SKILL.md is FORBIDDEN from doing this arithmetic inline.
 * All totals/tiers/spesen/VAT/Geraete come from here so the error class
 * the Command Center's engine prevented cannot silently return.
 *
 * Pure: no external dependencies, no I/O beyond reading the two JSON paths
 * given on argv and printing one JSON result block to stdout.
 *
 *   bun compute.ts <config.json> <input.json>
 *   (npx tsx compute.ts / node --experimental-strip-types also work)
 *
 * v0.10.0 — separate Montage-/Fahrt-Saetze pro Tier + eigenstaendiger
 * Samstags-/Sonntags-Zuschlag (statt einem einzelnen Wochenend-Satz),
 * Geraete-/KFZ-Abrechnung pro benanntem Fahrzeug (nicht nur pro Person),
 * und ein optionaler "pause_pre_applied"-Modus fuer Firmen, deren
 * Stundenerfassung Arbeit-/Fahrtzeit bereits pausenbereinigt liefert
 * (z.B. Fahrt-h = reine Pendelzeit, nicht die volle Reisezeit).
 * Alle Werte bleiben config-getrieben — nichts firmenspezifisch fest verdrahtet.
 */

interface TierRates { montage: number; fahrt: number }
interface VehicleCfg { label?: string }
interface Config {
  vat_rate: number;
  tiers: Record<string, TierRates>;
  default_tier: string;
  zuschlag_samstag: number;      // z.B. 0.25 = +25%
  zuschlag_sonntag: number;      // z.B. 0.50 = +50%
  weekend_days: number[];        // JS getUTCDay(): 0=Sun..6=Sat — welche Tage ueberhaupt Zuschlag bekommen
  people: Record<string, { name: string; tier: string; vehicle?: string }>;
  vehicles?: Record<string, VehicleCfg>;
  pflicht_pause_h: number;       // statutory minimum break per worked day
  daily_cap_total_h: number;     // cap on (arbeit + fahrt) per day (e.g. 17)
  pause_pre_applied?: boolean;   // true: arbeit_h/fahrt_h in den Rows sind bereits pausenbereinigt (Netto)
  spesen: { volltag_24h: number; halbtag_8h: number };
  hotel_cost: number;
  kfz_rate_per_km: number;
}
interface Row {
  person: string;                // match key
  date: string;                  // YYYY-MM-DD
  arbeit_h: number;
  fahrt_h?: number;              // Fahrt-/Reisezeit; siehe pause_pre_applied fuer die genaue Bedeutung
  pause_h?: number;              // nur relevant wenn pause_pre_applied=false
  hotel?: boolean;
  km?: number;
  vehicle?: string;              // optionales Row-Override; sonst config.people[person].vehicle
}
interface RunInput { kw: number; jahr: number; baustelle: string; rows: Row[] }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function fail(msg: string): never {
  console.error(`compute.ts error: ${msg}`);
  process.exit(1);
}

function loadJson<T>(path: string, what: string): T {
  try {
    const fs = require("node:fs");
    return JSON.parse(fs.readFileSync(path, "utf8")) as T;
  } catch (e) {
    fail(`could not read ${what} at ${path}: ${(e as Error).message}`);
  }
}

function dayKind(dateStr: string, weekendDays: number[]): "werktag" | "samstag" | "sonntag" {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) fail(`invalid date: ${dateStr}`);
  const dow = d.getUTCDay();
  if (!weekendDays.includes(dow)) return "werktag";
  return dow === 6 ? "samstag" : "sonntag";
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

function zuschlagFactor(kind: "werktag" | "samstag" | "sonntag", cfg: Config): number {
  if (kind === "samstag") return 1 + (cfg.zuschlag_samstag ?? 0);
  if (kind === "sonntag") return 1 + (cfg.zuschlag_sonntag ?? 0);
  return 1;
}

function main() {
  const [configPath, inputPath] = process.argv.slice(2);
  if (!configPath || !inputPath) fail("usage: compute.ts <config.json> <input.json>");

  const config = loadJson<Config>(configPath, "config");
  const input = loadJson<RunInput>(inputPath, "input");
  const warnings: string[] = [];
  const pausePreApplied = !!config.pause_pre_applied;

  if (!Array.isArray(input.rows) || input.rows.length === 0) fail("input.rows is empty");

  const byPerson = new Map<string, Row[]>();
  for (const r of input.rows) {
    if (!byPerson.has(r.person)) byPerson.set(r.person, []);
    byPerson.get(r.person)!.push(r);
  }

  const people: any[] = [];
  const vehicleTotals = new Map<string, { km_total: number; rows: number }>();
  let summeNetto = 0;
  let spesenApplied = false;

  for (const [personKey, rows] of byPerson) {
    rows.sort((a, b) => a.date.localeCompare(b.date));

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

    const days: any[] = [];
    const activeDays: { date: string; hotel: boolean }[] = [];
    let montageSummeH = 0, montageBetrag = 0;
    let fahrtSummeH = 0, fahrtBetrag = 0;
    const sub: Record<string, number> = {
      montage_werktag_h: 0, montage_werktag_betrag: 0,
      montage_samstag_h: 0, montage_samstag_betrag: 0,
      montage_sonntag_h: 0, montage_sonntag_betrag: 0,
      fahrt_werktag_h: 0, fahrt_werktag_betrag: 0,
      fahrt_samstag_h: 0, fahrt_samstag_betrag: 0,
      fahrt_sonntag_h: 0, fahrt_sonntag_betrag: 0,
    };
    let hotelNights = 0;

    for (const r of rows) {
      let arbeit = r.arbeit_h ?? 0;
      let fahrt = r.fahrt_h ?? 0;

      if (!pausePreApplied) {
        // Legacy-Modus: Pause wird hier einmalig vom Gesamt abgezogen (alte Ein-Satz-Logik,
        // Kappung vor Aufteilung Montage/Fahrt — nur fuer Firmen ohne Pendel-Konzept).
        const pflicht = Math.max(config.pflicht_pause_h, r.pause_h ?? 0);
        let brutto = arbeit + fahrt;
        if (brutto > config.daily_cap_total_h) {
          brutto = config.daily_cap_total_h;
          warnings.push(`${displayName} ${r.date}: Tag auf ${config.daily_cap_total_h}h gekappt — bitte prüfen.`);
        }
        const netto = Math.max(0, brutto - pflicht);
        const ratio = (arbeit + fahrt) > 0 ? netto / (arbeit + fahrt) : 0;
        arbeit = round2(arbeit * ratio);
        fahrt = round2(fahrt * ratio);
      } else {
        // Galant-Modus: arbeit_h/fahrt_h kommen bereits pausenbereinigt aus der Erfassung
        // (Fahrt-h = Pendelanteil, nicht volle Reisezeit) — nur noch Kappungs-Warnung, kein Abzug.
        if (arbeit + fahrt > config.daily_cap_total_h) {
          warnings.push(`${displayName} ${r.date}: Arbeit+Fahrt = ${round2(arbeit + fahrt)}h über Obergrenze ${config.daily_cap_total_h}h — bitte prüfen (nicht automatisch gekürzt).`);
        }
      }

      const kind = dayKind(r.date, config.weekend_days);
      const factor = zuschlagFactor(kind, config);
      const mRate = round2(tier.montage * factor);
      const fRate = round2(tier.fahrt * factor);
      const mBetrag = round2(arbeit * mRate);
      const fBetrag = round2(fahrt * fRate);

      montageSummeH = round2(montageSummeH + arbeit);
      montageBetrag = round2(montageBetrag + mBetrag);
      fahrtSummeH = round2(fahrtSummeH + fahrt);
      fahrtBetrag = round2(fahrtBetrag + fBetrag);

      sub[`montage_${kind}_h`] = round2(sub[`montage_${kind}_h`] + arbeit);
      sub[`montage_${kind}_betrag`] = round2(sub[`montage_${kind}_betrag`] + mBetrag);
      sub[`fahrt_${kind}_h`] = round2(sub[`fahrt_${kind}_h`] + fahrt);
      sub[`fahrt_${kind}_betrag`] = round2(sub[`fahrt_${kind}_betrag`] + fBetrag);

      if (r.hotel) hotelNights += 1;
      if (arbeit > 0 || fahrt > 0) activeDays.push({ date: r.date, hotel: !!r.hotel });

      if ((r.km ?? 0) > 0) {
        const veh = r.vehicle ?? pcfg?.vehicle;
        if (!veh) {
          warnings.push(`${displayName} ${r.date}: ${r.km} km erfasst, aber kein Fahrzeug zugeordnet (config.people[...].vehicle oder row.vehicle) — bitte prüfen.`);
        } else {
          if (config.vehicles && !config.vehicles[veh]) warnings.push(`Fahrzeug "${veh}" nicht in config.vehicles hinterlegt — bitte prüfen.`);
          const cur = vehicleTotals.get(veh) ?? { km_total: 0, rows: 0 };
          cur.km_total = round2(cur.km_total + (r.km ?? 0));
          cur.rows += 1;
          vehicleTotals.set(veh, cur);
        }
      }

      days.push({ date: r.date, kind, arbeit_h: arbeit, fahrt_h: fahrt, montage_rate: mRate, fahrt_rate: fRate, montage_betrag: mBetrag, fahrt_betrag: fBetrag });
    }

    // Spesen: Anreise (erster aktiver Tag) + Abreise (letzter aktiver Tag) = Halbtag (8h);
    // Tage dazwischen = Volltag (24h). Ein einzelner aktiver Tag = Halbtag.
    // Hotel-Flag wird gegen die erwartete An-/Abreise-Logik geprueft (bekannte Mehrwochen-Inkonsistenz,
    // siehe compute-rules.md) — bei Abweichung wird gewarnt statt still falsch zu rechnen.
    const spesenDays: any[] = [];
    let spesenBetrag = 0;
    const n = activeDays.length;
    activeDays.forEach((d, i) => {
      let kind: "volltag" | "halbtag";
      if (n === 1) kind = "halbtag";
      else if (i === 0 || i === n - 1) kind = "halbtag";
      else kind = "volltag";
      if (i === 0 && n > 1 && !d.hotel) warnings.push(`${displayName}: erster aktiver Tag (${d.date}) ohne Hotel-Flag, aber als Anreise (Halbtag) gewertet — bitte prüfen.`);
      if (i === n - 1 && n > 1 && d.hotel) warnings.push(`${displayName}: letzter aktiver Tag (${d.date}) hat Hotel=ja — evtl. Fortsetzung in Folgewoche statt Abreise; Spesen ggf. auf Volltag prüfen (bekannte Mehrwochen-Inkonsistenz).`);
      const amount = kind === "volltag" ? config.spesen.volltag_24h : config.spesen.halbtag_8h;
      spesenBetrag = round2(spesenBetrag + amount);
      spesenDays.push({ date: d.date, kind, amount });
    });
    if (n > 0) spesenApplied = true;

    const hotelBetrag = round2(hotelNights * config.hotel_cost);
    const zwischensumme = round2(montageBetrag + fahrtBetrag + spesenBetrag + hotelBetrag);
    summeNetto = round2(summeNetto + zwischensumme);

    people.push({
      person: personKey, name: displayName, tier: tierName,
      days, spesen_days: spesenDays,
      montage_summe_h: montageSummeH, montage_betrag: montageBetrag,
      fahrt_summe_h: fahrtSummeH, fahrt_betrag: fahrtBetrag,
      subtotals: sub,
      spesen_betrag: spesenBetrag,
      hotel_naechte: hotelNights, hotel_betrag: hotelBetrag,
      zwischensumme,
    });
  }

  if (spesenApplied) warnings.push(`Spesen-Heuristik (An-/Abreise = Halbtag, dazwischen Volltag) auf alle Personen angewandt — bitte prüfen.`);

  const vehicles = [...vehicleTotals.entries()].map(([id, v]) => ({
    vehicle: id,
    label: config.vehicles?.[id]?.label ?? id,
    km_total: v.km_total,
    betrag: round2(v.km_total * config.kfz_rate_per_km),
  }));
  const geraeteBetrag = round2(vehicles.reduce((s, v) => s + v.betrag, 0));
  summeNetto = round2(summeNetto + geraeteBetrag);

  const wrongWeek = [...new Set(input.rows.map((r) => r.date).filter((d) => isoWeek(d) !== input.kw))];
  if (wrongWeek.length) warnings.push(`Datum außerhalb KW ${input.kw}: ${wrongWeek.join(", ")} — bitte prüfen (Lesefehler?).`);

  const mwstBetrag = round2(summeNetto * config.vat_rate);
  const summeBrutto = round2(summeNetto + mwstBetrag);

  const result = {
    kw: input.kw, jahr: input.jahr, baustelle: input.baustelle,
    waehrung: "EUR",
    people,
    vehicles,
    geraete_betrag: geraeteBetrag,
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
