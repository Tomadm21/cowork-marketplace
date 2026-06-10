#!/usr/bin/env bun
/**
 * Command Center — operator review report generator (deterministic, dependency-free).
 * Mirrors dashboard.ts: best-effort, never crashes on missing/partial state.
 *   bun review.ts <workspace_root> [output.md]
 * Note: sub-threshold friction is dropped per window (watermark) — a deliberate noise floor; counts do not accumulate across reviews.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type SignalType = "correction" | "recurring_check" | "observation" | "fact" | "tech_change";
export interface Signal { ts: string; process: string; type: SignalType; key: string; detail?: string; }
export interface Pattern {
  name: string; keys: string[]; beleg: string;
  impact: "hoch" | "mittel" | "niedrig"; aufwand?: string; empfehlung?: string;
}

export function loadSignals(raw: string): Signal[] {
  const out: Signal[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let e: any;
    try { e = JSON.parse(t); } catch { continue; }
    if (!e || typeof e !== "object") continue;
    if (typeof e.key !== "string" || typeof e.type !== "string") continue;
    out.push({
      ts: String(e.ts ?? ""), process: String(e.process ?? ""),
      type: e.type as SignalType, key: e.key,
      detail: e.detail != null ? String(e.detail) : undefined,
    });
  }
  return out;
}

// Assumes the signals.md contract: UTC Z-suffixed timestamps, which compare correctly lexically.
export function windowSignals(signals: Signal[], watermarkTs: string): Signal[] {
  if (!watermarkTs) return signals;
  return signals.filter((s) => s.ts > watermarkTs);
}

export interface Cluster {
  key: string; count: number; type: SignalType; details: string[];
  pattern?: Pattern; rank: number;
}
export interface GateResult {
  stapel: Cluster[]; geparkt: Cluster[]; candidates: Cluster[];
  facts: Signal[]; tech: Cluster[];
}

const IMPACT_WEIGHT: Record<Pattern["impact"], number> = { hoch: 3, mittel: 2, niedrig: 1 };

export function gate(signals: Signal[], patterns: Pattern[], threshold = 3): GateResult {
  const patternForKey = (key: string): Pattern | undefined =>
    patterns.find((p) => p.keys.includes(key));

  const facts = signals.filter((s) => s.type === "fact");

  // tech clusters are notices — rank stays 0, render order is insertion order.
  const techMap = new Map<string, Cluster>();
  for (const s of signals.filter((s) => s.type === "tech_change")) {
    const c = techMap.get(s.key) ?? { key: s.key, count: 0, type: "tech_change" as SignalType, details: [], rank: 0 };
    c.count++; if (s.detail) c.details.push(s.detail);
    techMap.set(s.key, c);
  }
  const tech = [...techMap.values()];

  // Contract (signals.md): one key → one type. If a producer violates it, first-seen wins.
  const clusterMap = new Map<string, Cluster>();
  for (const s of signals) {
    if (!(s.type === "correction" || s.type === "recurring_check" || s.type === "observation")) continue;
    const c = clusterMap.get(s.key) ?? { key: s.key, count: 0, type: s.type, details: [], rank: 0 };
    c.count++; if (s.detail) c.details.push(s.detail);
    clusterMap.set(s.key, c);
  }

  const stapel: Cluster[] = [], geparkt: Cluster[] = [], candidates: Cluster[] = [];
  for (const c of clusterMap.values()) {
    const p = patternForKey(c.key);
    c.pattern = p;
    c.rank = c.count * (p ? IMPACT_WEIGHT[p.impact] : 1);
    const isObservation = c.type === "observation";
    if (!isObservation && c.count < threshold) continue; // below recurrence → dropped
    if (!p) { geparkt.push(c); continue; }                // no evidence → parked
    if (isObservation) candidates.push(c); else stapel.push(c);
  }
  const byRank = (a: Cluster, b: Cluster) => b.rank - a.rank || a.key.localeCompare(b.key);
  stapel.sort(byRank); candidates.sort(byRank); geparkt.sort(byRank);
  return { stapel, geparkt, candidates, facts, tech };
}

export function parsePatterns(md: string): Pattern[] {
  const out: Pattern[] = [];
  const blocks = md.split(/^##\s+/m).slice(1); // each block starts right after "## "
  for (const b of blocks) {
    const name = (b.split("\n", 1)[0] || "").trim();
    const field = (n: string): string => {
      const m = b.match(new RegExp(`^[-*]\\s*${n}[ \\t]*:[ \\t]*(.+)$`, "im"));
      return m ? m[1].trim() : "";
    };
    const keysRaw = field("keys");
    if (!keysRaw) continue; // not a machine pattern
    const keys = keysRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const impactRaw = field("impact").toLowerCase();
    const impact = (["hoch", "mittel", "niedrig"].includes(impactRaw) ? impactRaw : "mittel") as Pattern["impact"];
    out.push({ name, keys, beleg: field("beleg"), impact, aufwand: field("aufwand"), empfehlung: field("empfehlung") });
  }
  return out;
}

export function maxTs(signals: Signal[]): string {
  return signals.reduce((m, s) => (s.ts > m ? s.ts : m), "");
}

function clusterLines(cs: Cluster[]): string {
  return cs.map((c) => {
    const head = `- **${c.key}** — ${c.count}×` + (c.pattern ? ` · Muster: *${c.pattern.name}* (Impact ${c.pattern.impact})` : "");
    const emp = c.pattern?.empfehlung ? `\n  - Empfehlung: ${c.pattern.empfehlung}` : "";
    const ex = c.details[0] ? `\n  - Beispiel: ${c.details[0].replace(/\s+/g, " ")}` : "";
    return head + emp + ex;
  }).join("\n");
}

export function renderReport(firm: string, sinceTs: string, r: GateResult): string {
  const since = sinceTs ? `seit ${sinceTs}` : "seit Beginn (erster Review)";
  const sec = (title: string, body: string, empty: string) =>
    `\n## ${title}\n\n${body.trim() ? body : `_${empty}_`}\n`;

  const facts = r.facts.length
    ? r.facts.map((f) => `- ${f.key}${f.detail ? ` — ${f.detail.replace(/\s+/g, " ")}` : ""}`).join("\n")
    : "";

  return `# Optimierungs-Bericht — ${firm}

Fenster: ${since}.
` +
    sec("Getorter Stapel (Wiederholung + Beleg)", clusterLines(r.stapel),
        "Nichts hat in diesem Fenster Wiederholung ≥3 und einen Beleg erreicht.") +
    sec("Kontext-Vertiefung — Fakten bestätigen", facts,
        "Keine offenen Fakten.") +
    sec("Neue-Automatisierung-Kandidaten (baut nur Tom)", clusterLines(r.candidates),
        "Keine belegten Automatisierungs-Kandidaten.") +
    sec("Technik-Hinweise", clusterLines(r.tech),
        "Keine technischen Änderungen erkannt.") +
    sec("Geparkt (wiederkehrend, aber unbelegt)", clusterLines(r.geparkt),
        "Nichts geparkt.") +
    `\n---\n_Bericht ist eine Empfehlung. Jede Plugin-Änderung ist ein bewusster Schritt von Tom — nichts wendet sich selbst an._\n`;
}

// ── IO (used by main only) ──

function readFileSafe(p: string): string | null { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }

function firmName(ws: string): string {
  const md = readFileSafe(path.join(ws, "_firma", "company-context.md"));
  if (md) {
    const h = md.match(/^#\s*Firmenkontext\s*[—–-]\s*(.+)\s*$/m);
    if (h && h[1] && !h[1].includes("{{")) return h[1].trim();
    const f = md.match(/Firmenname:\s*(.+)/);
    if (f && f[1] && !f[1].includes("{{")) return f[1].trim();
  }
  return "Dein Betrieb";
}

function main() {
  const ws = process.argv[2];
  if (!ws) { console.error("usage: review.ts <workspace_root> [output.md]"); process.exit(1); }
  const out = process.argv[3] || path.join(ws, "_firma", "optimierung-bericht.md");
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));

  const patternsMd = readFileSafe(process.env.CC_PATTERNS_MD || path.join(scriptDir, "../../../reference/patterns.md")) || "";
  const patterns = parsePatterns(patternsMd);

  const signals = loadSignals(readFileSafe(path.join(ws, "_firma", "_state", "signals.jsonl")) || "");
  const wmRaw = readFileSafe(path.join(ws, "_firma", "_state", "review-watermark.json"));
  let watermark = "";
  try { watermark = wmRaw ? String(JSON.parse(wmRaw).last_review_ts ?? "") : ""; } catch { watermark = ""; }

  const windowed = windowSignals(signals, watermark);
  const result = gate(windowed, patterns, 3);
  const md = renderReport(firmName(ws), watermark, result);

  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, md, "utf8");
    const newWm = maxTs(windowed) || watermark;
    if (newWm) {
      const wmPath = path.join(ws, "_firma", "_state", "review-watermark.json");
      fs.mkdirSync(path.dirname(wmPath), { recursive: true });
      fs.writeFileSync(wmPath, JSON.stringify({ last_review_ts: newWm }, null, 2), "utf8");
    }
  } catch (e) {
    console.error(`review.ts: could not write ${out}: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(path.resolve(out));
}

if (import.meta.main) main();
